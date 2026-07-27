import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { distanceMeters, arrivalEvents, GEOFENCE_RADIUS_M } from '../src/lib/geofence.js';
import { checkGeofence } from '../src/socket/handlers/rider.js';
import { truncateAuthTables, testPrisma } from './helpers/db.js';

const WAREHOUSE = { lat: 48.8566, lng: 2.3522 };
const CUSTOMER = { lat: 48.8606, lng: 2.3376 };
// ~55m north of the customer (0.0005° lat), inside the 120m radius
const NEAR_CUSTOMER = { lat: CUSTOMER.lat + 0.0005, lng: CUSTOMER.lng };
// ~550m away, outside
const FAR = { lat: CUSTOMER.lat + 0.005, lng: CUSTOMER.lng };

function order(status: string) {
  return {
    status,
    pickupLat: WAREHOUSE.lat, pickupLng: WAREHOUSE.lng,
    dropoffLat: CUSTOMER.lat, dropoffLng: CUSTOMER.lng,
  };
}

describe('distanceMeters', () => {
  it('is ~0 for the same point', () => {
    expect(distanceMeters(CUSTOMER, CUSTOMER)).toBeLessThan(1);
  });
  it('measures a known short offset within tolerance', () => {
    const d = distanceMeters(CUSTOMER, NEAR_CUSTOMER);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(70);
  });
});

describe('arrivalEvents', () => {
  it('fires rider_near_customer while carrying and inside the radius', () => {
    expect(arrivalEvents(order('in_transit'), NEAR_CUSTOMER)).toEqual(['rider_near_customer']);
    expect(arrivalEvents(order('picked_up'), CUSTOMER)).toEqual(['rider_near_customer']);
  });

  it('fires rider_near_warehouse only while still heading to pick up', () => {
    expect(arrivalEvents(order('rider_assigned'), WAREHOUSE)).toEqual(['rider_near_warehouse']);
  });

  it('does not fire the customer geofence before pickup', () => {
    // at the customer point but status is rider_assigned (not carrying yet) → no customer event
    expect(arrivalEvents(order('rider_assigned'), CUSTOMER)).toEqual([]);
  });

  it('does not fire when outside the radius', () => {
    expect(arrivalEvents(order('in_transit'), FAR)).toEqual([]);
  });

  it('does not fire on a terminal status even if positioned at the address', () => {
    expect(arrivalEvents(order('delivered'), CUSTOMER)).toEqual([]);
  });

  it('is inert when coordinates are missing', () => {
    const noCoords = { status: 'in_transit', pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null };
    expect(arrivalEvents(noCoords, CUSTOMER)).toEqual([]);
  });

  it('the radius constant is a sane urban value', () => {
    expect(GEOFENCE_RADIUS_M).toBeGreaterThanOrEqual(50);
    expect(GEOFENCE_RADIUS_M).toBeLessThanOrEqual(300);
  });
});

describe('checkGeofence (dispatch integration)', () => {
  beforeEach(truncateAuthTables);

  it('creates exactly one arrival notification for the customer, idempotently', async () => {
    const customer = await testPrisma.user.create({
      data: { email: `geo-${randomUUID()}@example.com`, name: 'Geo Cust', phone: '', passwordHash: 'x' },
    });
    const orderId = randomUUID();
    const ord = { customerId: customer.id, ...order('in_transit') };

    await checkGeofence(orderId, ord, CUSTOMER);
    await checkGeofence(orderId, ord, CUSTOMER); // second fix inside the geofence — must not duplicate

    const notifs = await testPrisma.notification.findMany({ where: { userId: customer.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]?.type).toBe('rider_near_customer');
  });

  it('does nothing for a guest order (no customerId)', async () => {
    const before = await testPrisma.notification.count();
    await checkGeofence(randomUUID(), { customerId: null, ...order('in_transit') }, CUSTOMER);
    expect(await testPrisma.notification.count()).toBe(before);
  });
});
