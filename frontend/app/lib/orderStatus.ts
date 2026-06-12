// Backend OrderStatus enum (canonical rider state machine + the awaiting_payment pre-pool state)
export type BackendOrderStatus =
  | 'awaiting_payment'
  | 'pending_assignment'
  | 'rider_assigned'
  | 'at_warehouse'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

// Frontend display enum (what the orders UI renders)
export type DisplayOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'rider_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'cancelled'

// D-02: the backend enum stays canonical; the frontend maps it to its divergent display enum.
const STATUS_MAP: Record<BackendOrderStatus, DisplayOrderStatus> = {
  awaiting_payment: 'pending',
  pending_assignment: 'confirmed',
  rider_assigned: 'rider_assigned',
  at_warehouse: 'preparing',
  picked_up: 'picked_up',
  in_transit: 'in_transit',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

export function mapOrderStatus(status: string): DisplayOrderStatus {
  return STATUS_MAP[status as BackendOrderStatus] ?? 'pending'
}
