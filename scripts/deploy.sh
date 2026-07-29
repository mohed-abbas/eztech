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
#   ./scripts/deploy.sh --rollback                 # REFUSES: prints the manual recovery procedure
#   ./scripts/deploy.sh --seed                     # one-off idempotent admin seed on the active slot
#   ./scripts/deploy.sh --seed-demo                # demo accounts + EZDEMO- orders (soutenance data)
#   ./scripts/deploy.sh --seed-catalog             # categories/warehouses/brands/products + stock
#   ./scripts/deploy.sh --seed-zones               # delivery zones (the order dropoff gate)
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
# Read by nothing. It describes a per-SHA image retention policy that this script does not
# implement: no service declares an image: key, so every build lands on <service>:latest and no
# previous version is ever retained. Kept only as the marker for where that policy would attach if
# the image tagging is ever fixed. See the block above rollback() for the full mechanism.
# shellcheck disable=SC2034
KEEP_IMAGE_TAGS=2

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
    # Standalone --seed doesn't go through build_images(), so source .env.production here too —
    # `docker compose run` still parses the whole file and needs the required ${STRIPE_*} vars
    # (frontend build args) resolved even though we only run the backend service.
    if [[ -f "${PROJECT_DIR}/.env.production" ]]; then
        set -a; source "${PROJECT_DIR}/.env.production"; set +a
    else
        error ".env.production not found at ${PROJECT_DIR}/.env.production"; exit 1
    fi
    log "Seeding admin user on backend-${slot} (idempotent)..."
    # The prod image strips tsx (see backend/Dockerfile); the seeds are precompiled during
    # `npm run build` (tsconfig.seed.json) so they run on plain node. The path carries the prisma/
    # segment because tsconfig.seed.json roots at the package (demo-orders.ts imports src/lib/pricing).
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
        --entrypoint "node dist/seed/prisma/seed.js" \
        "backend-${slot}" 2>&1 | tee -a "${LOG_FILE}"
    success "Seed completed"
}

# Demo dataset: warehouse manager, riders, customers and a spread of paid/delivered EZDEMO- orders so
# the analytics dashboard and the four-role walkthrough have real data. NOT part of a normal deploy —
# invoke explicitly with `./scripts/deploy.sh --seed-demo`. Idempotent: it deletes and regenerates its
# own EZDEMO- orders and upserts its accounts, leaving real orders untouched.
seed_demo() {
    local slot; slot=$(get_active_slot)
    if [[ "${slot}" == "none" ]]; then
        error "No active slot to seed — deploy first"; exit 1
    fi
    if [[ -f "${PROJECT_DIR}/.env.production" ]]; then
        set -a; source "${PROJECT_DIR}/.env.production"; set +a
    else
        error ".env.production not found at ${PROJECT_DIR}/.env.production"; exit 1
    fi
    log "Seeding DEMO dataset on backend-${slot} (idempotent)..."
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
        --entrypoint "node dist/seed/prisma/seed-demo.js" \
        "backend-${slot}" 2>&1 | tee -a "${LOG_FILE}"
    success "Demo seed completed"
}

# Catalog dataset: categories, warehouses, brands, products and per-warehouse stock, read from
# backend/prisma/data/*.json (shipped inside the image via `COPY prisma ./prisma`). NOT part of a
# normal deploy: invoke it explicitly with `./scripts/deploy.sh --seed-catalog`. Idempotent: every
# write is an upsert keyed on slug (categories/brands/products) or name (warehouses), so re-running
# never duplicates and never wipes an existing catalog.
seed_catalog() {
    local slot; slot=$(get_active_slot)
    if [[ "${slot}" == "none" ]]; then
        error "No active slot to seed — deploy first"; exit 1
    fi
    if [[ -f "${PROJECT_DIR}/.env.production" ]]; then
        set -a; source "${PROJECT_DIR}/.env.production"; set +a
    else
        error ".env.production not found at ${PROJECT_DIR}/.env.production"; exit 1
    fi
    log "Seeding CATALOG on backend-${slot} (idempotent)..."
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
        --entrypoint "node dist/seed/prisma/seed-catalog.js" \
        "backend-${slot}" 2>&1 | tee -a "${LOG_FILE}"
    success "Catalog seed completed"
}

# Delivery zones, read from backend/prisma/data/service-zones.json. This is the highest-value
# recovery command in the file: backend/src/lib/zones.ts gates every order dropoff on
# `zones.some(...)` over the ACTIVE zones, and `.some()` on an empty table returns false, so an empty
# zone table therefore rejects every address as out of zone and no order can be created at all.
# Idempotent: upserts by the GeoJSON feature's stable properties.id, so re-running only refreshes
# name/geometry/isActive on the rows it owns and leaves any hand-drawn zone untouched.
seed_zones() {
    local slot; slot=$(get_active_slot)
    if [[ "${slot}" == "none" ]]; then
        error "No active slot to seed — deploy first"; exit 1
    fi
    if [[ -f "${PROJECT_DIR}/.env.production" ]]; then
        set -a; source "${PROJECT_DIR}/.env.production"; set +a
    else
        error ".env.production not found at ${PROJECT_DIR}/.env.production"; exit 1
    fi
    log "Seeding delivery ZONES on backend-${slot} (idempotent)..."
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
        --entrypoint "node dist/seed/prisma/seed-zones.js" \
        "backend-${slot}" 2>&1 | tee -a "${LOG_FILE}"
    success "Zone seed completed"
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

# --- Rollback: deliberately refuses to run ---
#
# This script CANNOT roll back. The previous version of this function claimed it could, and that
# claim was the dangerous part: it started the idle slot, flipped nginx onto it, printed "Rollback
# complete" and left the operator on the exact build they were trying to escape. Verified mechanism,
# read off this file and docker-compose.prod.yml rather than assumed:
#
#   1. Neither backend-* nor frontend-* declares an image: key (only eztech-mongo does, image:
#      mongo:8). Compose therefore derives one image name per service from the project directory,
#      eztech-backend-blue / eztech-backend-green / eztech-frontend-blue / eztech-frontend-green,
#      each tagged with the literal string "latest". Nothing is ever tagged by SHA. DEPLOY_SHA is
#      exported by build_images() and deploy() and interpolated by NOTHING in the compose file, so
#      it has no effect at all.
#
#   2. build_images() always builds the -blue services whatever slot is being deployed. Because the
#      derived names differ per service, that does NOT overwrite the green image. It simply means the
#      green image is never built by this function.
#
#   3. So on a deploy to green, "docker compose up -d backend-green" is what actually produces the
#      green image: compose builds a service whose image is missing. It builds from the working tree
#      as it stands after the git pull, so green does get the new code. It is also the only reason
#      the deploy works, and it is implicit rather than intended.
#
#   4. cleanup_images() then prunes the project's stopped containers FIRST, which releases the image
#      references held by the slot that was just stopped, and afterwards runs docker rmi against
#      every eztech-backend/frontend image whose tag does not contain a kept SHA. The tag is
#      "latest", so that test never matches and every one of the four images is a deletion
#      candidate. The two backing the running slot fail the rmi with a conflict and survive via
#      "|| true"; the two belonging to the now stopped slot are deleted for real.
#
#   Net effect after any successful deploy: exactly ONE color has images on disk and they hold the
#   current code. There is no previous image left to start. The old rollback() therefore ran
#   "up -d" against a slot with no image, compose rebuilt it from the working tree, which still
#   holds the bad code because rollback never checked anything out, and the bad build was served
#   again. It then wrote previous-sha into deployed-sha, so the state files ended up describing a
#   version that had never run. In the rarer case where cleanup_images failed to delete the idle
#   images, rolling back to blue would start the image build_images had just rebuilt from the new
#   tree, so that branch loses too.
#
#   previous-sha is a git commit id and nothing more. No image carries it, and no code path in this
#   script ever checks it out. It is a note to a human, not something the script can act on.
#
# Why this is not fixed here instead: a real fix means per-SHA image: keys in
# docker-compose.prod.yml, and that changes the image every OTHER compose call resolves, including
# the "run --rm" used for prisma migrate deploy and for all four seed commands, none of which set
# DEPLOY_SHA. Those would resolve an empty tag, find no image, and start BUILDING production images
# as a side effect of seeding. It also flips cleanup_images' keep test from never-matching to
# matching, changing what it deletes on its very first run. And it still would not make rollback
# safe on its own, because prisma migrate deploy only rolls forward: any rollback across a migration
# boundary runs old code against a new schema. That is not a change to make blind, with no VPS to
# test against, on a script that stops and starts production containers. So this command refuses and
# hands over the procedure that actually works.
rollback() {
    local current_slot idle_slot deployed_sha previous_sha
    current_slot=$(get_active_slot)
    if [[ "${current_slot}" == "none" ]]; then
        error "--rollback is DISABLED, and there is nothing to roll back anyway: no active slot is"
        error "recorded in ${STATE_FILE}. Nothing was started, stopped or changed."
        exit 1
    fi
    idle_slot=$(get_next_slot "${current_slot}")
    deployed_sha=$(cat "${STATE_DIR}/deployed-sha" 2>/dev/null || echo "unknown")
    previous_sha=$(cat "${STATE_DIR}/previous-sha" 2>/dev/null || echo "")

    error "--rollback is DISABLED and did nothing. This script cannot roll back."
    warn "No image tagged with a previous SHA exists on this host. docker-compose.prod.yml declares"
    warn "no image: key for backend/frontend, so every build lands on <service>:latest, and"
    warn "cleanup_images() deletes the idle color's images at the end of every deploy. Starting the"
    warn "idle slot would make compose REBUILD it from the current working tree, serving you the"
    warn "very build you are trying to escape. Use the procedure below instead."

    # Keep the placeholder short so it stays readable when it is substituted into every command
    # below; the instruction on how to find the real value goes here rather than inline.
    if [[ -z "${previous_sha}" || "${previous_sha}" == "none" ]]; then
        previous_sha="<known-good-sha>"
        warn "No previous-sha is recorded, so <known-good-sha> below is a placeholder. Find the real"
        warn "commit first with: git -C ${PROJECT_DIR} log --oneline -20"
    fi

    tee -a "${LOG_FILE}" <<ROLLBACK_EOF

================================================================================
 MANUAL ROLLBACK PROCEDURE
================================================================================
 State recorded by this script:
   active slot    : ${current_slot}
   idle slot      : ${idle_slot}
   deployed sha   : ${deployed_sha}
   target sha     : ${previous_sha}

 Run everything below on the VPS, from ${PROJECT_DIR}.

 STEP 0 - check migrations before anything else.
   prisma migrate deploy only rolls forward. If the bad sha added a migration
   that the target sha does not have, the old code will run against the new
   schema. Find out first:
       git -C ${PROJECT_DIR} diff --name-only ${previous_sha} ${deployed_sha} -- prisma/migrations
   If that prints anything, either write and apply a down migration by hand
   before serving the old code, or accept the schema drift knowingly. Do not
   skip this step just because the app looks fine.

 STEP 1 - put the working tree on the known-good commit. Detached HEAD is fine,
   nothing here gets pushed.
       git -C ${PROJECT_DIR} fetch --all
       git -C ${PROJECT_DIR} checkout ${previous_sha}

 STEP 2 - load production env and build the IDLE slot from that source.
       cd ${PROJECT_DIR}
       set -a; . ./.env.production; set +a
       docker compose -f ${COMPOSE_FILE} build backend-${idle_slot} frontend-${idle_slot}

 STEP 3 - start the idle slot and wait for BOTH to report healthy.
       docker compose -f ${COMPOSE_FILE} up -d backend-${idle_slot} frontend-${idle_slot}
       docker inspect --format='{{.State.Health.Status}}' eztech-backend-${idle_slot}
       docker inspect --format='{{.State.Health.Status}}' eztech-frontend-${idle_slot}
   The backend healthcheck runs a real SELECT 1 against Postgres, so "healthy"
   here means it can genuinely serve. Do not continue until both say healthy.

 STEP 4 - flip nginx onto the idle slot. Confirm the container name first: this
   host runs a shared nginx and this script assumes it is called
   "${NGINX_CONTAINER}", which may be wrong.
       docker ps --format '{{.Names}}' | grep -i nginx
   Then write ${NGINX_UPSTREAM_CONF} with exactly these two lines:
       upstream eztech_frontend { server eztech-frontend-${idle_slot}:3000; }
       upstream eztech_backend { server eztech-backend-${idle_slot}:3001; }
   and validate before reloading:
       docker exec <nginx-container> nginx -t
       docker exec <nginx-container> nginx -s reload

 STEP 5 - verify through the public URL BEFORE stopping anything.
       curl -sS https://eztech.thecodeman.cloud/api/health
   Expect HTTP 200 with checks.database = ok.

 STEP 6 - only now stop the bad slot.
       docker compose -f ${COMPOSE_FILE} stop backend-${current_slot} frontend-${current_slot}

 STEP 7 - record the new truth, or the next deploy will act on stale state.
       echo ${idle_slot} > ${STATE_FILE}
       echo ${previous_sha} > ${STATE_DIR}/deployed-sha

 STEP 8 - put the working tree back on its branch, otherwise the next deploy's
   git pull --ff-only fails on the detached HEAD.
       git -C ${PROJECT_DIR} checkout <branch>

 Do NOT try to shortcut this with ./scripts/deploy.sh. Without --skip-build its
 main() runs git pull --ff-only first, which fails on a detached HEAD, and it
 would rebuild from whatever the tree happens to hold.
================================================================================

ROLLBACK_EOF

    exit 1
}

usage() {
    cat <<USAGE
Usage: $(basename "$0") [options]

  (no args)              git pull --ff-only, build locally (cached), blue-green flip
  --no-cache             fresh build (no docker layer cache)
  --skip-build --sha S   skip build, deploy pre-built images tagged for sha S
  --rollback             DISABLED: does nothing, prints the manual rollback procedure, exits 1
  --seed                 run the idempotent admin seed against the active slot
  --seed-demo            run the demo dataset seed (accounts + EZDEMO- orders) — for the demo/soutenance
  --seed-catalog         run the idempotent catalog seed (categories, warehouses, brands, products, stock)
  --seed-zones           run the idempotent delivery-zone seed (an empty zone table rejects every order)
  -h, --help             show this help
USAGE
}

main() {
    local do_rollback=false do_seed=false do_seed_demo=false do_seed_catalog=false do_seed_zones=false
    local skip_build=false no_cache=false custom_sha=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --rollback) do_rollback=true; shift ;;
            --seed) do_seed=true; shift ;;
            --seed-demo) do_seed_demo=true; shift ;;
            --seed-catalog) do_seed_catalog=true; shift ;;
            --seed-zones) do_seed_zones=true; shift ;;
            --skip-build) skip_build=true; shift ;;
            --no-cache) no_cache=true; shift ;;
            --sha) custom_sha="$2"; shift 2 ;;
            -h | --help) usage; exit 0 ;;
            *) error "Unknown option: $1"; usage; exit 1 ;;
        esac
    done

    # --rollback starts and stops nothing, so it deliberately runs BEFORE acquire_lock: during an
    # incident the recovery procedure has to be printable even if a half-finished deploy is still
    # holding the lock. rollback() always exits non-zero; the explicit exit below is a guard in case
    # that ever stops being true, so control can never fall through into a deploy.
    if [[ "${do_rollback}" == "true" ]]; then
        rollback
        # shellcheck disable=SC2317  # unreachable today because rollback() always exits; kept so
        # control can never fall through into a deploy if that ever changes.
        exit 1
    fi

    acquire_lock

    if [[ "${do_seed}" == "true" ]]; then
        run_seed
        exit 0
    fi

    if [[ "${do_seed_demo}" == "true" ]]; then
        seed_demo
        exit 0
    fi

    if [[ "${do_seed_catalog}" == "true" ]]; then
        seed_catalog
        exit 0
    fi

    if [[ "${do_seed_zones}" == "true" ]]; then
        seed_zones
        exit 0
    fi

    if [[ "${skip_build}" != "true" ]]; then
        log "Pulling latest main..."
        git -C "${PROJECT_DIR}" pull --ff-only 2>&1 | tee -a "${LOG_FILE}"
    fi

    deploy "${skip_build}" "${custom_sha}" "${no_cache}"
}

main "$@"
