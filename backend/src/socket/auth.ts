import jwt from 'jsonwebtoken';
import type { Socket, ExtendedError } from 'socket.io';
import { verifyAccessToken } from '../middleware/auth.js';

// JWT handshake middleware (D-11, Pitfall B). Reuses verifyAccessToken — never re-implements JWT
// verification. A bad/missing token → next(Error) so the client receives connect_error (TRACK-05).
// A valid token's {sub,role} is stored on socket.data.user; an exp-based timeout force-disconnects
// the socket at token expiry so a long-lived connection cannot outlive its access token.

// Augment Socket.io's per-socket data bag with the authenticated user.
declare module 'socket.io' {
  interface SocketData {
    user?: { sub: string; role: string };
  }
}

export function socketAuth(socket: Socket, next: (err?: ExtendedError) => void): void {
  const token = socket.handshake.auth['token'] as unknown;
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
