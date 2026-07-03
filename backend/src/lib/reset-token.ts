import crypto from 'node:crypto';
import { prisma } from './prisma.js';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueResetToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex'); // 256 bits entropy
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 60 * 60_000); // 1h expiry
  await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw; // raw token emailed to the user, never stored
}

export async function consumeResetToken(raw: string): Promise<string | null> {
  const tokenHash = hashToken(raw);

  return prisma.$transaction(async (tx) => {
    // atomic single-use claim — 0 rows if already used, expired, or unknown (mirrors
    // rotateRefreshToken's revokedAt-null claim idiom)
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (claimed.count === 0) return null;

    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    return row?.userId ?? null;
  });
}
