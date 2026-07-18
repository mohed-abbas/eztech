import jwt from 'jsonwebtoken';
import type { DefaultEventsMap, ExtendedError, Socket } from 'socket.io';
import { verifyAccessToken } from '../middleware/auth.js';
import { ACCESS_COOKIE, parseCookieHeader } from '../lib/cookies.js';

// JWT handshake middleware (D-11, Pitfall B). Reuses verifyAccessToken — never re-implements JWT
// verification. A bad/missing token → next(Error) so the client receives connect_error (TRACK-05).
// A valid token's {sub,role} is stored on socket.data.user; an exp-based timeout force-disconnects
// the socket at token expiry so a long-lived connection cannot outlive its access token.

// The authenticated user this middleware attaches to socket.data.
export interface AuthenticatedUser {
  sub: string;
  role: string;
}

// Socket.io's per-socket `data` bag is a plain generic type parameter (default `any`) on Socket<>
// — unlike Express's Request, there is no exported `SocketData` interface for `declare module
// 'socket.io'` to merge into, so that pattern silently no-ops. Every handler that reads
// socket.data.user must instead thread this shape through the Socket<> generic via this shared
// alias (D-11).
export interface AppSocketData {
  user?: AuthenticatedUser;
}

export type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, AppSocketData>;

export function socketAuth(socket: AppSocket, next: (err?: ExtendedError) => void): void {
  // cross-origin/native clients pass the token in handshake.auth; same-origin browsers rely on the
  // httpOnly ez_access cookie sent with the handshake request (Phase 7).
  const authToken = socket.handshake.auth['token'] as unknown;
  const token = typeof authToken === 'string' && authToken.length > 0
    ? authToken
    : parseCookieHeader(socket.handshake.headers.cookie)[ACCESS_COOKIE];
  if (typeof token !== 'string' || token.length === 0) {
    next(new Error('unauthorized'));
    return;
  }
  try {
    const { sub, role } = verifyAccessToken(token);
    socket.data.user = { sub, role };

    // Decode the (already-verified) token once to read exp, then schedule a force-disconnect at
    // expiry. Clamp non-positive delays to an immediate disconnect; clear the timer on disconnect.
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      const delay = decoded.exp * 1000 - Date.now();
      const timer = setTimeout(
        () => {
          socket.disconnect(true);
        },
        Math.max(delay, 0),
      );
      // unref so a pending expiry timer never keeps the process alive on its own.
      timer.unref?.();
      socket.on('disconnect', () => clearTimeout(timer));
    }

    next();
  } catch {
    next(new Error('unauthorized'));
  }
}
