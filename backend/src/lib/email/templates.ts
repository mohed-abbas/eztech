// Per-event email content builders (N-01). Each fills a content slot in renderEmail() and returns
// {subject, html, text} for dispatch()'s `email` field. Subjects are always fully static strings —
// dynamic values (order reference, product name, dates) only ever land in the HTML/text BODY,
// never in subject/headers (email header/content injection guard, RESEARCH §Security Domain).
import { renderEmail } from './layout.js';

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Escapes values that could originate from admin/rider-entered data (product names, etc.) before
// they land in the HTML body — cheap defense-in-depth alongside the subject/header guard above.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

// N-06 essential (always sends, ignores emailOptOut): order_confirmed, rider_assigned,
// order_picked_up, order_delivered, return_reminder, password_reset.
// N-06 non-essential (opt-out suppresses): low_stock.

export function orderConfirmedEmail(params: { orderReference: string; total: number; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const { html, text } = renderEmail({
    heading: 'Commande confirmee',
    bodyHtml:
      `<p>Votre commande <strong>${ref}</strong> est confirmee. Montant paye : <strong>${params.total.toFixed(2)} €</strong>.</p>` +
      `<p>Vous recevrez une notification a chaque etape de la livraison.</p>`,
    ctaLabel: 'Suivre ma commande',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Votre commande est confirmee', html, text };
}

export function riderAssignedEmail(params: { orderReference: string; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const { html, text } = renderEmail({
    heading: 'Un livreur a ete assigne',
    bodyHtml: `<p>Un livreur a accepte votre commande <strong>${ref}</strong> et prepare la collecte.</p>`,
    ctaLabel: 'Suivre ma livraison',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Un livreur a ete assigne a votre commande', html, text };
}

export function orderPickedUpEmail(params: { orderReference: string; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const { html, text } = renderEmail({
    heading: 'Commande recuperee',
    bodyHtml: `<p>Votre commande <strong>${ref}</strong> a ete recuperee et est en route.</p>`,
    ctaLabel: 'Suivre ma livraison',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Votre commande a ete recuperee', html, text };
}

export function orderDeliveredEmail(params: { orderReference: string; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const { html, text } = renderEmail({
    heading: 'Commande livree',
    bodyHtml: `<p>Votre commande <strong>${ref}</strong> a ete livree. Merci de votre confiance !</p>`,
    ctaLabel: 'Voir ma commande',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Votre commande a ete livree', html, text };
}

export function returnReminderEmail(params: { orderReference: string; rentalEndsAt: Date; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const when = escapeHtml(formatDateTime(params.rentalEndsAt));
  const { html, text } = renderEmail({
    heading: 'Pensez a retourner votre location',
    bodyHtml:
      `<p>La periode de location de votre commande <strong>${ref}</strong> se termine le <strong>${when}</strong>.</p>` +
      `<p>Planifiez le retour du materiel avant cette date pour eviter des frais supplementaires.</p>`,
    ctaLabel: 'Planifier le retour',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Rappel : retour de votre location', html, text };
}

export function lateFeePendingEmail(params: { orderReference: string; amount: number; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const amount = escapeHtml(`${params.amount.toFixed(2)} €`);
  const { html, text } = renderEmail({
    heading: 'Frais de retard sur votre location',
    bodyHtml:
      `<p>La periode de location de votre commande <strong>${ref}</strong> est depassee.</p>` +
      `<p>Des frais de retard de <strong>${amount}</strong> vont etre preleves sur votre carte enregistree.</p>`,
    ctaLabel: 'Voir la commande',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Frais de retard sur votre location', html, text };
}

export function lateFeeChargedEmail(params: { orderReference: string; amount: number; orderUrl: string }): EmailContent {
  const ref = escapeHtml(params.orderReference);
  const amount = escapeHtml(`${params.amount.toFixed(2)} €`);
  const { html, text } = renderEmail({
    heading: 'Frais de retard preleves',
    bodyHtml:
      `<p>Des frais de retard de <strong>${amount}</strong> ont ete preleves pour votre commande <strong>${ref}</strong>.</p>` +
      `<p>Retournez le materiel au plus vite pour eviter des frais supplementaires.</p>`,
    ctaLabel: 'Planifier le retour',
    ctaUrl: params.orderUrl,
    unsubscribe: false,
  });
  return { subject: 'Frais de retard preleves', html, text };
}

export function lowStockEmail(params: { productName: string; quantity: number; adminUrl: string }): EmailContent {
  const name = escapeHtml(params.productName);
  const { html, text } = renderEmail({
    heading: 'Alerte stock bas',
    bodyHtml: `<p>Le produit <strong>${name}</strong> passe sous le seuil d'alerte : <strong>${params.quantity}</strong> unite(s) restante(s).</p>`,
    ctaLabel: 'Voir le stock',
    ctaUrl: params.adminUrl,
    unsubscribe: true,
  });
  return { subject: 'Alerte stock bas', html, text };
}

export function verifyEmailEmail(params: { verifyUrl: string }): EmailContent {
  const { html, text } = renderEmail({
    heading: 'Confirmez votre adresse email',
    bodyHtml:
      `<p>Bienvenue chez EzTech ! Confirmez votre adresse email pour pouvoir passer votre premiere commande.</p>` +
      `<p>Ce lien expire dans 24 heures. Si vous n'etes pas a l'origine de cette inscription, ignorez cet email.</p>`,
    ctaLabel: 'Confirmer mon email',
    ctaUrl: params.verifyUrl,
    unsubscribe: false,
  });
  return { subject: 'Confirmez votre adresse email', html, text };
}

export function passwordResetEmail(params: { resetUrl: string }): EmailContent {
  const { html, text } = renderEmail({
    heading: 'Reinitialisation de votre mot de passe',
    bodyHtml:
      `<p>Une demande de reinitialisation de mot de passe a ete effectuee pour votre compte.</p>` +
      `<p>Ce lien expire dans 1 heure. Si vous n'etes pas a l'origine de cette demande, ignorez cet email.</p>`,
    ctaLabel: 'Reinitialiser mon mot de passe',
    ctaUrl: params.resetUrl,
    unsubscribe: false,
  });
  return { subject: 'Reinitialisation de votre mot de passe', html, text };
}
