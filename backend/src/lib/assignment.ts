// Fenêtre d'offre d'une commande au pool de livreurs (assignmentExpiresAt).
// Quand une commande entre dans le pool, elle est « offerte » jusqu'à cette échéance ;
// le cron assignment-expiry ré-arme la fenêtre des offres non prises (fenêtre glissante).
export const OFFER_TTL_MS = 3 * 60 * 1000;

export function nextAssignmentExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + OFFER_TTL_MS);
}
