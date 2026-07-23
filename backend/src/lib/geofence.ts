// Geofence detection for rider arrival (Module 5). Pure and side-effect free so it is unit-testable
// without a socket or DB. The rider's live GPS fixes (already written to Mongo, H1) are compared to
// the order's warehouse (pickup) and customer (dropoff) coordinates; entering a radius triggers a
// one-shot notification. We deliberately do NOT auto-transition order status — GPS is noisy and a
// bad fix must never flip an order to delivered ahead of the rider's manual tap (accepted per plan).

export interface LatLng { lat: number; lng: number }

export interface GeofenceOrder {
  status: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}

export type GeofenceEvent = 'rider_near_warehouse' | 'rider_near_customer';

// radius (metres) within which the rider counts as "arrived". 120m tolerates typical urban GPS
// error while staying tight enough not to fire a block early.
export const GEOFENCE_RADIUS_M = 120;

// great-circle distance in metres (haversine)
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function within(pos: LatLng, lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  return distanceMeters(pos, { lat, lng }) <= GEOFENCE_RADIUS_M;
}

// Which arrival geofences the rider has entered for this order, gated by the status where each is
// meaningful: warehouse only while still heading there (rider_assigned), customer only while
// carrying the parcel (picked_up / in_transit). Returns [] when nothing is triggered.
export function arrivalEvents(order: GeofenceOrder, pos: LatLng): GeofenceEvent[] {
  const events: GeofenceEvent[] = [];
  if (order.status === 'rider_assigned' && within(pos, order.pickupLat, order.pickupLng)) {
    events.push('rider_near_warehouse');
  }
  if ((order.status === 'picked_up' || order.status === 'in_transit') && within(pos, order.dropoffLat, order.dropoffLng)) {
    events.push('rider_near_customer');
  }
  return events;
}
