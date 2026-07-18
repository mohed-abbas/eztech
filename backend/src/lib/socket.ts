import { Server } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { socketAuth } from '../socket/auth.js';
import type { AppSocket, AppSocketData } from '../socket/auth.js';
import { registerOrderHandler } from '../socket/handlers/order.js';
import { registerRiderHandler } from '../socket/handlers/rider.js';
import { userRoom, RIDERS_AVAILABLE } from '../socket/rooms.js';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

// Server typed with the same per-socket data shape as AppSocket (D-11) — every handler and the
// getIO() accessor see socket.data.user as a real type instead of `any`.
export type AppServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, AppSocketData>;

// Socket.io server singleton (D-08/D-13, RESEARCH Pattern 1). Module-private _io binding; consumers
// import the FUNCTIONS only (initSocket/getIO), never the live instance — this is the ESM
// circular-import guard (AP2): routes/orders.ts calls getIO() lazily at emit time, so it never
// depends on _io being populated at import.

let _io: AppServer | null = null;

// CORS allowlist sourced from CORS_ORIGIN — the exact chain copied from app.ts:17-26. NEVER '*' (AP4).
function corsOrigins(): string[] {
  return (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// Bell + rider-available room joins (Phase 6, NOTIF-04/05, T-06-07/T-06-08). Server-authoritative:
// the room is always derived from socket.data.user.sub (set by socketAuth), never a client-supplied
// id — there is no message path that lets a client join an arbitrary user's bell room. The
// riders:available join reuses the exact approved+online gate as notifyOnlineRiders()
// (lib/notifications.ts:79) / routes/rider.ts:343. The DB lookup is wrapped so a failure never
// drops the connection (mirrors the best-effort getIO() swallow idiom used elsewhere, orders.ts:341).
async function joinNotificationRooms(socket: AppSocket): Promise<void> {
  const user = socket.data.user;
  if (!user) return;

  // every authenticated socket owns exactly its own bell room.
  void socket.join(userRoom(user.sub));

  if (user.role !== 'rider') return;
  try {
    const rider = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { riderApplicationStatus: true, riderOnline: true },
    });
    if (rider?.riderApplicationStatus === 'approved' && rider.riderOnline === true) {
      void socket.join(RIDERS_AVAILABLE);
    }
  } catch (err) {
    logger.error({ err }, 'riders:available join lookup failed — room join skipped');
  }
}

// Per-connection handler wiring (D-15). Attaches the subscribe:order (room-auth + join + last-known
// emit) and rider:position (authz + throttle + Mongo upsert + rider-moved broadcast) handlers to
// each authenticated socket. Functions only — no circular import on the live _io binding; the rider
// handler reaches getIO() lazily at emit time.
export function registerHandlers(_io: AppServer, socket: AppSocket): void {
  void joinNotificationRooms(socket);
  registerOrderHandler(socket);
  registerRiderHandler(socket);
}

// Construct the single Socket.io Server against the shared http.Server (D-08), install the JWT
// handshake middleware (D-11), and wire connection handling. Returns the live instance.
export function initSocket(httpServer: HttpServer): AppServer {
  const io: AppServer = new Server(httpServer, {
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
export function getIO(): AppServer {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
}
