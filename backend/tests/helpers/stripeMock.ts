import { vi } from 'vitest';

// Self-contained Stripe SDK mock — lets the suite run with no live keys and no
// out-of-process stripe-mock binary (RESEARCH A4). Each test tunes behavior via the
// mutable `stripeMockState` below (e.g. force constructEvent to throw for the
// bad-signature path).

export type FakeStripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

// Mutable knobs the tests flip before exercising a route.
export const stripeMockState = {
  // when true, webhooks.constructEvent throws (simulates an invalid signature)
  constructEventThrows: false,
  // when true, paymentIntents.create throws (simulates an off_session card decline)
  paymentIntentsCreateThrows: false,
  // the event constructEvent returns on the happy path
  nextEvent: null as FakeStripeEvent | null,
  // records of calls for assertions
  paymentIntentsCreate: [] as unknown[],
  refundsCreate: [] as unknown[],
  customersCreate: [] as unknown[],
};

export function resetStripeMock(): void {
  stripeMockState.constructEventThrows = false;
  stripeMockState.paymentIntentsCreateThrows = false;
  stripeMockState.nextEvent = null;
  stripeMockState.paymentIntentsCreate = [];
  stripeMockState.refundsCreate = [];
  stripeMockState.customersCreate = [];
}

// Build a fake `payment_intent.succeeded` event carrying metadata.orderId, matching
// the shape the webhook handler reads (event.data.object.metadata.orderId).
export function fakePaymentIntentSucceeded(orderId: string, paymentIntentId = 'pi_test'): FakeStripeEvent {
  return {
    id: `evt_${orderId}`,
    type: 'payment_intent.succeeded',
    data: { object: { id: paymentIntentId, metadata: { orderId } } },
  };
}

// vi.mock factory for the `stripe` module. A test registers it with:
//   vi.mock('stripe', () => stripeMockFactory());
export function stripeMockFactory() {
  class FakeStripe {
    paymentIntents = {
      // no await needed — callers always `await` this call, and `await` on a plain value resolves
      // immediately, so a sync return keeps the real SDK's Promise-returning call shape for callers.
      // `status: 'succeeded'` supports the off_session late-fee charge path (Module 9).
      create: vi.fn((params: unknown) => {
        if (stripeMockState.paymentIntentsCreateThrows) throw new Error('Your card was declined.');
        stripeMockState.paymentIntentsCreate.push(params);
        return { id: 'pi_test', client_secret: 'cs_test', status: 'succeeded' };
      }),
    };

    customers = {
      create: vi.fn((params: unknown) => {
        stripeMockState.customersCreate.push(params);
        return { id: 'cus_test' };
      }),
    };

    refunds = {
      create: vi.fn((params: unknown) => {
        stripeMockState.refundsCreate.push(params);
        return { id: 're_test' };
      }),
    };

    webhooks = {
      constructEvent: vi.fn((..._args: unknown[]) => {
        if (stripeMockState.constructEventThrows) {
          throw new Error('No signatures found matching the expected signature for payload');
        }
        if (!stripeMockState.nextEvent) {
          throw new Error('stripeMock: no nextEvent configured');
        }
        return stripeMockState.nextEvent;
      }),
    };
  }

  return { default: FakeStripe };
}
