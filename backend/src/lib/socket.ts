import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { socketAuth } from '../socket/auth.js';

// Socket.io server singleton (D-08/D-13, RESEARCH Pattern 1). Module-private _io binding; consumers
// import the FUNCTIONS only (initSocket/getIO), never the live instance — this is the ESM
// circular-import guard (AP2): routes/orders.ts calls getIO() lazily at emit time, so it never
// depends on _io being populated at import.

let _io: Server | null = null;

// CORS allowlist sourced from CORS_ORIGIN — the exact chain copied from app.ts:17-26. NEVER '*' (AP4).
function corsOrigins(): string[] {
  return (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// Plan 03 fill-in point: replaces this body with the rider + order socket.on registrations using the
// frozen event names. Kept as a no-op stub now so CORS + auth + exp-disconnect are fully functional.
export function registerHandlers(_io: Server, _socket: Socket): void {
  // intentionally empty — wired in Plan 03
}

// Construct the single Socket.io Server against the shared http.Server (D-08), install the JWT
// handshake middleware (D-11), and wire connection handling. Returns the live instance.
export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins(),
      credentials: true,
    },
  });

  io.use(socketAuth);
  io.on('connection', (socket) => {
    registerHandlers(io, socket);
  });

  _io = io;
  return io;
}

// Live-instance accessor — throws before init so callers fail loud, never on an undefined binding.
export function getIO(): Server {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
}
