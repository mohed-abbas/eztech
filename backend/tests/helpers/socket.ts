import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import type { Server } from 'socket.io';
import { signAccessToken, type JwtPayload } from '../../src/middleware/auth.js';

// Socket test helpers — mirror tests/helpers/db.ts (single-responsibility exports).
// JWT minting reuses signAccessToken, the same source the app verifies against.

export function mintToken(payload: JwtPayload, opts?: Parameters<typeof signAccessToken>[1]): string {
  return signAccessToken(payload, opts);
}

// connect-with-token: returns a connected socket.io-client, or rejects on connect_error.
export function connectWith(token: string, port: number): Promise<ClientSocket> {
  return new Promise<ClientSocket>((resolve, reject) => {
    const socket = Client(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

// room-membership assertion helper — reads io.sockets.adapter.rooms (server-side truth).
export function roomMembers(io: Server, room: string): string[] {
  const set = io.sockets.adapter.rooms.get(room);
  return set ? [...set] : [];
}

// small awaitable for a named server→client event with a timeout (keeps RED failures on assertion).
export function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 1500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}
