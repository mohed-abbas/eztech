#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# EZTECH BLUE-GREEN DEPLOY — build on the VPS, no registry (ADR-016 D-06)
# ============================================================================
# Mirrors the owner's Permitto deploy.sh model (project-annuel/shared/reference/
# deploy.permitto-model.sh), NOT tasktrox's GHCR-pull version. Images are built
# locally on the VPS via `docker compose build`, driven by a `git pull`. See
# .planning/phases/08-production-deployment/08-VPS-CONTRACT.md for the full
# contract this script implements.
#
# Runs from /home/murx/apps/eztech (this repo, checked out on the VPS).
#
# Usage:
#   ./scripts/deploy.sh                           # git pull, build locally (cached), blue-green flip
#   ./scripts/deploy.sh --no-cache                 # fresh build (no docker layer cache)
#   ./scripts/deploy.sh --skip-build --sha abc123   # pre-built images path — kept for parity, unused
#   ./scripts/deploy.sh --rollback                 # start previous slot, flip back
#   ./scripts/deploy.sh --seed                     # one-off idempotent admin seed on the active slot
# ============================================================================

# --- Configuration ---
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
STATE_DIR="${PROJECT_DIR}/.deploy"
STATE_FILE="${STATE_DIR}/active-slot"
LOCK_DIR="${STATE_DIR}/lock"
LOG_FILE="${STATE_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"

NGINX_CONF_DIR="/home/murx/shared/nginx/conf.d"
NGINX_UPSTREAM_CONF="${NGINX_CONF_DIR}/eztech-upstream.conf"
NGINX_CONTAINER="nginx"

HEALTH_MAX_RETRIES=30
HEALTH_RETRY_INTERVAL=5
DRAIN_WAIT=10
KEEP_IMAGE_TAGS=2 # current + previous SHA, for rollback

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[deploy]${NC} $(date '+%H:%M:%S') $*" | tee -a "${LOG_FILE}"; }
success() { echo -e "${GREEN}[deploy]${NC} $(date '+%H:%M:%S') $*" | tee -a "${LOG_FILE}"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $(date '+%H:%M:%S') $*" | tee -a "${LOG_FILE}"; }
error() { echo -e "${RED}[deploy]${NC} $(date '+%H:%M:%S') $*" | tee -a "${LOG_FILE}"; }

mkdir -p "${STATE_DIR}"

# --- Lock ---
acquire_lock() {
    if mkdir "${LOCK_DIR}" 2>/dev/null; then
        echo $$ > "${LOCK_DIR}/pid"; trap release_lock EXIT
        log "Deployment lock acquired (PID: $$)"
    else
        local lock_pid; lock_pid=$(cat "${LOCK_DIR}/pid" 2>/dev/null || echo "unknown")
        error "Another deployment is in progress (PID: ${lock_pid})"
        error "If stale, remove manually: rm -rf ${LOCK_DIR}"; exit 1
    fi
}
release_lock() { rm -rf "${LOCK_DIR}"; log "Deployment lock released"; }

# --- Slot helpers ---
get_active_slot() { if [[ -f "${STATE_FILE}" ]]; then cat "${STATE_FILE}"; else echo "none"; fi; }
get_next_slot() { if [[ "$1" == "blue" ]]; then echo "green"; else echo "blue"; fi; }

wait_for_healthy() {
    local container_name="$1" max_retries="${HEALTH_MAX_RETRIES}" interval="${HEALTH_RETRY_INTERVAL}"
    log "Waiting for ${container_name} to become healthy..."
    for ((i = 1; i <= max_retries; i++)); do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "${container_name}" 2>/dev/null || echo "not_found")
        if [[ "${status}" == "healthy" ]]; then
            success "${container_name} is healthy (attempt ${i}/${max_retries})"
            return 0
        fi
        if [[ "${status}" == "not_found" ]]; then
            error "${container_name} container not found"
            return 1
        fi
        log "  ${container_name}: ${status} (attempt ${i}/${max_retries}, waiting ${interval}s...)"
        sleep "${interval}"
    done
    error "${container_name} did not become healthy within $((max_retries * interval))s"
    return 1
}

switch_nginx_upstream() {
    local slot="$1"
    log "Switching nginx upstream to ${slot} slot..."
    cat > "${NGINX_UPSTREAM_CONF}" <<UPSTREAM_EOF
# EzTech upstream targets — managed by scripts/deploy.sh
# Active slot: ${slot} — switched at $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# DO NOT EDIT MANUALLY
upstream eztech_frontend { server eztech-frontend-${slot}:3000; }
upstream eztech_backend { server eztech-backend-${slot}:3001; }
UPSTREAM_EOF
    log "Validating nginx configuration..."
    if ! docker exec "${NGINX_CONTAINER}" nginx -t 2>&1 | tee -a "${LOG_FILE}"; then
        error "Nginx configuration validation FAILED — upstream NOT switched, restoring previous conf"
        switch_nginx_upstream_restore "$2"
        return 1
    fi
    docker exec "${NGINX_CONTAINER}" nginx -s reload
    success "Nginx reloaded — traffic now routing to ${slot} slot"
}

# Restores the upstream conf to a known-good slot without re-validating (used only
# when the just-written conf already failed `nginx -t`, so we roll back to the slot
# that was serving before this deploy attempt).
switch_nginx_upstream_restore() {
    local previous_slot="$1"
    if [[ -z "${previous_slot}" || "${previous_slot}" == "none" ]]; then
        warn "No previous slot to restore nginx upstream to — leaving conf as-is for manual repair"
        return 0
    fi
    cat > "${NGINX_UPSTREAM_CONF}" <<UPSTREAM_EOF
# EzTech upstream targets — managed by scripts/deploy.sh
# Active slot: ${previous_slot} — restored after failed switch at $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# DO NOT EDIT MANUALLY
upstream eztech_frontend { server eztech-frontend-${previous_slot}:3000; }
upstream eztech_backend { server eztech-backend-${previous_slot}:3001; }
UPSTREAM_EOF
    docker exec "${NGINX_CONTAINER}" nginx -t 2>&1 | tee -a "${LOG_FILE}" && docker exec "${NGINX_CONTAINER}" nginx -s reload
}

build_images() {
    local sha="$1" no_cache="${2:-false}" cache_flag=""
    if [[ "${no_cache}" == "true" ]]; then cache_flag="--no-cache"; fi
    export DEPLOY_SHA="${sha}"
    if [[ -f "${PROJECT_DIR}/.env.production" ]]; then
        set -a; source "${PROJECT_DIR}/.env.production"; set +a
    else
        error ".env.production not found at ${PROJECT_DIR}/.env.production"; exit 1
    fi
    log "Building eztech images (sha=${sha})..."
    # Always builds the "-blue" tagged services (matches 08-VPS-CONTRACT.md step 5, mirrors the
    # Permitto model exactly). blue/green share the same Dockerfile/context, so this warms the
    # Docker build cache — when `docker compose up -d` later targets the green slot, compose's
    # implicit build for the missing green image reuses those cached layers almost for free.
    # shellcheck disable=SC2086
    docker compose -f "${COMPOSE_FILE}" build ${cache_flag} backend-blue frontend-blue 2>&1 | tee -a "${LOG_FILE}"
    success "Images built successfully"
}

run_migrations() {
    local slot="$1"
    log "Running database migrations on backend-${slot} (BEFORE it joins traffic)..."
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
        --entrypoint "npx prisma migrate deploy --schema ./prisma/schema.prisma" \
        "backend-${slot}" 2>&1 | tee -a "${LOG_FILE}"
    success "Database migrations completed"
}

run_seed() {
    local slot; slot=$(get_active_slot)
    if [[ "${slot}" == "none" ]]; then
        error "No active slot to seed — deploy first"; exit 1
    fi
    log "Seeding admin user on backend-${slot} (idempotent)..."
    # The prod image strips tsx (see backend/Dockerfile); the admin seed is precompiled to
    # dist/seed/seed.js during `npm run build` (tsconfig.seed.json) so it runs on plain node.
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
        --entrypoint "node dist/seed/seed.js" \
        "backend-${slot}" 2>&1 | tee -a "${LOG_FILE}"
    success "Seed completed"
}

cleanup_images() {
    log "Cleaning up stopped containers and stale images..."
    docker container prune -f --filter "label=com.docker.compose.project=eztech" 2>&1 | tee -a "${LOG_FILE}" || true

    # Keep only the current + previous SHA-tagged images for backend/frontend; everything
    # else built by this project is safe to remove (rollback only ever needs one step back).
    local keep_shas=()
    [[ -f "${STATE_DIR}/deployed-sha" ]] && keep_shas+=("$(cat "${STATE_DIR}/deployed-sha")")
    [[ -f "${STATE_DIR}/previous-sha" ]] && keep_shas+=("$(cat "${STATE_DIR}/previous-sha")")

    docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E '^eztech-(backend|frontend)' | while read -r repo_tag image_id; do
        local tag="${repo_tag##*:}"
        local keep=false
        for sha in "${keep_shas[@]:-}"; do
            [[ -n "${sha}" && "${tag}" == *"${sha}"* ]] && keep=true
        done
        if [[ "${keep}" == false ]]; then
            docker rmi "${image_id}" 2>&1 | tee -a "${LOG_FILE}" || true
        fi
    done

    docker image prune -f 2>&1 | tee -a "${LOG_FILE}" || true
    docker builder prune -f --filter until=24h 2>&1 | tee -a "${LOG_FILE}" || true
    docker volume prune -f 2>&1 | tee -a "${LOG_FILE}" || true

    # Keep the 10 most recent deploy logs.
    find "${STATE_DIR}" -maxdepth 1 -name 'deploy-*.log' -print0 2>/dev/null \
        | xargs -0 ls -t 2>/dev/null | tail -n +11 | xargs -r rm -f

    success "Cleanup complete"
}

deploy() {
    local skip_build="${1:-false}" custom_sha="${2:-}" no_cache="${3:-false}"
    local current_slot next_slot sha

    current_slot=$(get_active_slot)
    next_slot=$(get_next_slot "${current_slot}")
    if [[ "${current_slot}" == "none" ]]; then next_slot="blue"; fi

    if [[ -n "${custom_sha}" ]]; then
        sha="${custom_sha}"
    else
        sha=$(git -C "${PROJECT_DIR}" rev-parse --short HEAD)
    fi
    export DEPLOY_SHA="${sha}"

    # Idempotency: skip if this exact sha is already the deployed one.
    if [[ -f "${STATE_DIR}/deployed-sha" && "$(cat "${STATE_DIR}/deployed-sha")" == "${sha}" ]]; then
        success "sha ${sha} is already deployed on slot ${current_slot} — nothing to do"
        return 0
    fi

    log "Current slot: ${current_slot} — deploying sha ${sha} to slot: ${next_slot}"

    if [[ "${skip_build}" == "true" ]]; then
        log "Skipping build (pre-built images expected for sha ${sha})"
    else
        build_images "${sha}" "${no_cache}"
    fi

    run_migrations "${next_slot}"

    log "Starting backend-${next_slot} and frontend-${next_slot}..."
    docker compose -f "${COMPOSE_FILE}" up -d "backend-${next_slot}" "frontend-${next_slot}"

    if ! wait_for_healthy "eztech-backend-${next_slot}" || ! wait_for_healthy "eztech-frontend-${next_slot}"; then
        error "New slot ${next_slot} failed healthcheck — stopping it, old slot ${current_slot} stays live"
        docker compose -f "${COMPOSE_FILE}" stop "backend-${next_slot}" "frontend-${next_slot}"
        exit 1
    fi

    if ! switch_nginx_upstream "${next_slot}" "${current_slot}"; then
        error "Nginx switch failed — stopping new slot ${next_slot}, old slot ${current_slot} stays live"
        docker compose -f "${COMPOSE_FILE}" stop "backend-${next_slot}" "frontend-${next_slot}"
        exit 1
    fi

    if [[ "${current_slot}" != "none" ]]; then
        log "Draining old slot ${current_slot} for ${DRAIN_WAIT}s before stopping..."
        sleep "${DRAIN_WAIT}"
        docker compose -f "${COMPOSE_FILE}" stop "backend-${current_slot}" "frontend-${current_slot}"
    fi

    # State commit LAST — only after the new slot is confirmed live.
    [[ -f "${STATE_DIR}/deployed-sha" ]] && cp "${STATE_DIR}/deployed-sha" "${STATE_DIR}/previous-sha" || echo "none" > "${STATE_DIR}/previous-sha"
    echo "${next_slot}" > "${STATE_FILE}"
    echo "${sha}" > "${STATE_DIR}/deployed-sha"
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "${STATE_DIR}/deployed-at"

    cleanup_images

    success "Deploy complete — sha ${sha} live on slot ${next_slot}"
}

rollback() {
    local current_slot previous_sha previous_slot
    current_slot=$(get_active_slot)
    if [[ "${current_slot}" == "none" ]]; then
        error "No active slot — nothing to roll back"; exit 1
    fi
    previous_slot=$(get_next_slot "${current_slot}")
    previous_sha=$(cat "${STATE_DIR}/previous-sha" 2>/dev/null || echo "")

    if [[ -z "${previous_sha}" || "${previous_sha}" == "none" ]]; then
        error "No previous-sha recorded — cannot roll back automatically. Deploy manually with --sha <known-good>"
        exit 1
    fi

    warn "Rolling back: ${current_slot} (sha $(cat "${STATE_DIR}/deployed-sha" 2>/dev/null || echo unknown)) -> ${previous_slot} (sha ${previous_sha})"

    log "Starting previous slot backend-${previous_slot} / frontend-${previous_slot}..."
    docker compose -f "${COMPOSE_FILE}" up -d "backend-${previous_slot}" "frontend-${previous_slot}"

    if ! wait_for_healthy "eztech-backend-${previous_slot}" || ! wait_for_healthy "eztech-frontend-${previous_slot}"; then
        error "Previous slot ${previous_slot} failed to come back healthy — rollback aborted, current slot ${current_slot} stays live"
        exit 1
    fi

    if ! switch_nginx_upstream "${previous_slot}" "${current_slot}"; then
        error "Nginx switch failed during rollback — current slot ${current_slot} stays live"
        exit 1
    fi

    log "Draining ${current_slot} for ${DRAIN_WAIT}s before stopping..."
    sleep "${DRAIN_WAIT}"
    docker compose -f "${COMPOSE_FILE}" stop "backend-${current_slot}" "frontend-${current_slot}"

    echo "${previous_slot}" > "${STATE_FILE}"
    echo "${current_slot} rolled back from $(cat "${STATE_DIR}/deployed-sha" 2>/dev/null || echo unknown)" >> "${LOG_FILE}"
    echo "${previous_sha}" > "${STATE_DIR}/deployed-sha"

    success "Rollback complete — slot ${previous_slot} (sha ${previous_sha}) is now live"
}

usage() {
    cat <<USAGE
Usage: $(basename "$0") [options]

  (no args)              git pull --ff-only, build locally (cached), blue-green flip
  --no-cache             fresh build (no docker layer cache)
  --skip-build --sha S   skip build, deploy pre-built images tagged for sha S
  --rollback             start the previous slot, flip nginx back, stop current slot
  --seed                 run the idempotent admin seed against the active slot
  -h, --help             show this help
USAGE
}

main() {
    local do_rollback=false do_seed=false skip_build=false no_cache=false custom_sha=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --rollback) do_rollback=true; shift ;;
            --seed) do_seed=true; shift ;;
            --skip-build) skip_build=true; shift ;;
            --no-cache) no_cache=true; shift ;;
            --sha) custom_sha="$2"; shift 2 ;;
            -h | --help) usage; exit 0 ;;
            *) error "Unknown option: $1"; usage; exit 1 ;;
        esac
    done

    acquire_lock

    if [[ "${do_rollback}" == "true" ]]; then
        rollback
        exit 0
    fi

    if [[ "${do_seed}" == "true" ]]; then
        run_seed
        exit 0
    fi

    if [[ "${skip_build}" != "true" ]]; then
        log "Pulling latest main..."
        git -C "${PROJECT_DIR}" pull --ff-only 2>&1 | tee -a "${LOG_FILE}"
    fi

    deploy "${skip_build}" "${custom_sha}" "${no_cache}"
}

main "$@"
