import type Stripe from 'stripe';
import { env } from '../config/env.js';

// single Stripe client across the process — never instantiate per-request. The SDK bundles
// its own types since 8.0.1 (no @types/stripe). apiVersion is omitted to track the SDK default.
//
// The `stripe` package is loaded with a dynamic import so it is not pulled in during the
// synchronous module-graph evaluation of `buildApp()`. This keeps the test suite's hoisted
// `vi.mock('stripe', …)` fully initialized before the SDK is first constructed.
let clientPromise: Promise<Stripe> | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!clientPromise) {
    clientPromise = import('stripe').then(({ default: StripeCtor }) => new StripeCtor(env.STRIPE_SECRET_KEY));
  }
  return clientPromise;
}
