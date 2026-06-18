import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { socketAuth } from '../socket/auth.js';
import { registerOrderHandler } from '../socket/handlers/order.js';
import { registerRiderHandler } from '../socket/handlers/rider.js';

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

// Per-connection handler wiring (D-15). Attaches the subscribe:order (room-auth + join + last-known
// emit) and rider:position (authz + throttle + Mongo upsert + rider-moved broadcast) handlers to
// each authenticated socket. Functions only — no circular import on the live _io binding; the rider
// handler reaches getIO() lazily at emit time.
export function registerHandlers(_io: Server, socket: Socket): void {
  registerOrderHandler(socket);
  registerRiderHandler(socket);
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
