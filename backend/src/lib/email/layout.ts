// Shared branded email shell (N-01). Inline styles only, no external CSS/fonts — most email
// clients (Outlook, Gmail app) strip external stylesheet references and style blocks, so every
// rule lives on the element it styles. Every per-event template in templates.ts fills this shell.
// Source: RESEARCH §Architecture Patterns (N-01: inline-styled shell + plain-text part).

const BRAND_COLOR = '#7C3AED'; // --color-primary-600 (frontend/app/assets/css/tailwind.css)
const WORDMARK = 'EzTech';

// Dynamic values only ever land in bodyHtml/text (the BODY) — never in the subject, which every
// template.ts builder keeps fully static (email header/content injection guard, RESEARCH §Security).
export interface EmailSlot {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribe?: boolean;
}

// Best-effort HTML -> plain-text conversion of a body built entirely by our own template
// builders (never raw external HTML), so this only ever has to understand the small tag set
// templates.ts emits (p/br/h1-h6/li).
function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const UNSUBSCRIBE_TEXT =
  "Vous recevez cet email car vous avez un compte EzTech. Gerez vos preferences dans votre espace client.";

export function renderEmail(slot: EmailSlot): { html: string; text: string } {
  const hasCta = Boolean(slot.ctaLabel && slot.ctaUrl);

  const ctaHtml = hasCta
    ? `<tr><td style="padding:8px 32px 32px;">` +
      `<a href="${slot.ctaUrl}" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;` +
      `text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;` +
      `padding:12px 28px;border-radius:6px;">${slot.ctaLabel}</a></td></tr>`
    : '';

  const unsubscribeHtml = slot.unsubscribe
    ? `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#9CA3AF;">${UNSUBSCRIBE_TEXT}</p>`
    : '';

  const html =
    `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background-color:#F9FAFB;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:32px 0;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:480px;width:100%;">` +
    `<tr><td style="background-color:${BRAND_COLOR};padding:20px 32px;">` +
    `<span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${WORDMARK}</span>` +
    `</td></tr>` +
    `<tr><td style="padding:32px 32px 8px;">` +
    `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#111827;">${slot.heading}</h1>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#374151;">${slot.bodyHtml}</div>` +
    `</td></tr>` +
    ctaHtml +
    `<tr><td style="padding:24px 32px 32px;border-top:1px solid #E5E7EB;">` +
    `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9CA3AF;">${WORDMARK} — location de materiel</p>` +
    unsubscribeHtml +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`;

  const textParts = [
    slot.heading,
    '',
    stripHtmlToText(slot.bodyHtml),
    hasCta ? `\n${slot.ctaLabel}: ${slot.ctaUrl}` : '',
    `\n---\n${WORDMARK}`,
    slot.unsubscribe ? UNSUBSCRIBE_TEXT : '',
  ].filter((part) => part !== '');

  return { html, text: textParts.join('\n').trim() };
}
