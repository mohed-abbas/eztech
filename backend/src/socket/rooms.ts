// Pure room-name helper (D-10) — mirrors lib/zones.ts's stateless-helper shape.
// Centralizing the `order:<id>` string is what lets tests assert
// io.sockets.adapter.rooms membership without magic strings drifting.
export function orderRoom(id: string): string {
  return `order:${id}`;
}
