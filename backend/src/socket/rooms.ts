// Pure room-name helper (D-10) — mirrors lib/zones.ts's stateless-helper shape.
// Centralizing the `order:<id>` string is what lets tests assert
// io.sockets.adapter.rooms membership without magic strings drifting.
export function orderRoom(id: string): string {
  return `order:${id}`;
}

// every authenticated socket joins its own bell room on connect (Phase 6).
export function userRoom(id: string): string {
  return `user:${id}`;
}

// approved + online riders join this room to receive order:new alerts (Phase 6).
export const RIDERS_AVAILABLE = 'riders:available';
