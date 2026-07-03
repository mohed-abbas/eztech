import { Resend } from 'resend';
import { env } from '../config/env.js';

// null when RESEND_API_KEY is unset -> email is inert (mirrors the SENTRY_DSN pattern) so
// dev/CI/tests never need a real key and never send. Loads via the normal import graph
// (after the Sentry --import preload) -- never load this from the Sentry preload file (ADR-014).
export const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string } | { skipped: true } | { error: unknown }> {
  if (!resend) return { skipped: true };
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) return { error }; // SDK returns {data,error} -- it does NOT throw on API errors
  return { id: data!.id };
}
