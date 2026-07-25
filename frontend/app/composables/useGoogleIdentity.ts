// Loads Google Identity Services (GIS) once and exposes helpers to initialise the ID-token flow
// and render Google's official sign-in button. The client id comes from public runtimeConfig and
// is the same in every environment (the OAuth client registers both localhost and prod origins).
//
// Flow: renderButton() draws Google's button; when the user completes sign-in, GIS calls the
// callback with a `credential` (the ID token JWT), which the caller posts to /api/auth/google.

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string, callback: (r: GoogleCredentialResponse) => void }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

// load the GIS script exactly once, resolving when window.google.accounts.id is available
function loadGis(): Promise<void> {
  if (!import.meta.client) return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('failed to load Google Identity Services')))
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function useGoogleIdentity() {
  const { googleClientId } = useRuntimeConfig().public
  const clientId = googleClientId as string
  const enabled = computed(() => !!clientId)

  // Render Google's official button into `parent` and wire `onCredential` to fire with the ID token.
  async function renderButton(
    parent: HTMLElement,
    onCredential: (credential: string) => void,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    if (!enabled.value) return
    await loadGis()
    const id = window.google?.accounts?.id
    if (!id) return

    id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) })
    id.renderButton(parent, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width: parent.clientWidth || 320,
      ...options,
    })
  }

  return { enabled, renderButton }
}
