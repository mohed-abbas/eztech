// FROZEN Socket.io event contract (D-15). Casing is authoritative — do NOT rename.
// Both the server handlers and Ilia's rider client build against these exact names + payloads.
// One shared source so handlers and tests never drift from magic strings.

// client -> server: join the per-order room (after a DB ownership check, D-10).
export const SUBSCRIBE_ORDER = 'subscribe:order' as const;
// rider -> server: a single GPS fix on the rider's authenticated connection (D-03).
export const RIDER_POSITION = 'rider:position' as const;
// server -> room: a broadcast position update, emitted as named {lat,lng} (never a bare array, D-12).
export const RIDER_MOVED = 'rider-moved' as const;
// server -> room: an order status change, emitted on the OrderEvent write (D-15).
export const ORDER_STATUS = 'order-status' as const;

// Grouped constant for ergonomic imports / exhaustive references.
export const SOCKET_EVENTS = {
  SUBSCRIBE_ORDER,
  RIDER_POSITION,
  RIDER_MOVED,
  ORDER_STATUS,
} as const;

// ---- Payload contracts ----

// client -> server (subscribe:order)
export interface SubscribeOrderPayload {
  orderId: string;
}

// rider -> server (rider:position) — incoming GPS fix as named lat/lng (D-12).
export interface RiderPositionPayload {
  orderId: string;
  lat: number;
  lng: number;
  accuracy?: number;
}

// server -> room (rider-moved) — named {lat,lng} + write timestamp (D-12/D-15).
export interface RiderMovedPayload {
  lat: number;
  lng: number;
  at: string;
}

// server -> room (order-status) — emitted on an OrderEvent status transition (D-15).
export interface OrderStatusPayload {
  orderId: string;
  status: string;
}
