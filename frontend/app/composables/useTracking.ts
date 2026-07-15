// Plan de marquage Umami — les 4 étapes du tunnel d'achat.
// RGPD : les propriétés d'événement ne portent que des identifiants produit, des quantités et des
// montants. Jamais d'email, de nom, d'adresse ni de donnée de paiement.
type TrackProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (event: string, props?: TrackProps) => void }
  }
}

const TRAFFIC_SOURCE_KEY = 'ez-traffic-source'

export function useTracking() {
  function track(event: string, props?: TrackProps) {
    if (import.meta.server) return
    window.umami?.track(event, props)
  }

  // L'origine du trafic n'est présente que sur l'URL d'entrée : on la mémorise pour la session afin
  // de pouvoir l'attacher à checkout_success, tout au bout du tunnel.
  function captureTrafficSource() {
    const params = new URLSearchParams(window.location.search)
    const source = params.get('utm_source') ?? params.get('ref')
    if (source) sessionStorage.setItem(TRAFFIC_SOURCE_KEY, source)
  }

  function trafficSource(): string {
    if (import.meta.server) return 'direct'
    return sessionStorage.getItem(TRAFFIC_SOURCE_KEY) ?? 'direct'
  }

  return { track, captureTrafficSource, trafficSource }
}
