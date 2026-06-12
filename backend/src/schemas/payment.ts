import { z } from 'zod';

// POST /api/payments/create-intent — the client supplies only the order it wants to pay for;
// the amount/currency are derived server-side from the order total (never client-sent).
export const CreateIntentSchema = z.object({
  orderId: z.string().uuid(),
});
