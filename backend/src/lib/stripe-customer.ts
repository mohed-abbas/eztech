import { prisma } from './prisma.js';
import { getStripe } from './stripe.js';

// Returns the user's Stripe customer id, creating (and persisting) one on first use. Having a
// customer is what lets the late-fee job charge the saved card off_session later (Module 9).
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  if (!user) throw new Error('user_not_found');
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
