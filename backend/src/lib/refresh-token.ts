import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

// parse "30d" / "15m" etc. into milliseconds for expiresAt
function parseTtlMs(ttl: string): number {
  const n = parseInt(ttl, 10);
  const unit = ttl.slice(String(n).length);
  const multipliers: Record<string, number> = {
    s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000,
    w: 604_800_000, y: 31_536_000_000,
  };
  const mult = multipliers[unit];
  if (!mult) throw new Error(`unknown TTL unit: ${unit}`);
  return n * mult;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex'); // 256 bits entropy
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + parseTtlMs(env.JWT_REFRESH_TTL));
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw; // raw token sent to client, never stored
}

export async function rotateRefreshToken(
  raw: string,
  userId: string,
): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) return null;
  if (existing.revokedAt) return null;               // already revoked
  if (existing.expiresAt < new Date()) return null;  // expired
  if (existing.userId !== userId) return null;       // ownership mismatch

  // revoke old token atomically, issue new one
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  return generateRefreshToken(userId);
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const tokenHash = hashToken(raw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyRefreshToken(
  raw: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(raw);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt < new Date()) return null;
  return { userId: row.userId };
}
