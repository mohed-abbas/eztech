import crypto from 'node:crypto';
import { prisma } from './prisma.js';

// Email-confirmation token (Module 1). Same hashed single-use idiom as reset-token.ts: 256 bits of
// entropy, only the sha256 is stored, the raw is emailed. Longer window than a password reset (24h)
// because a first-order sign-up may not open the mail immediately.
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueVerificationToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex'); // 256 bits entropy
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000); // 24h expiry
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw; // raw token emailed to the user, never stored
}

// Atomic single-use claim → returns the userId and stamps User.emailVerifiedAt in the same
// transaction. Returns null if the token is unknown, expired, or already consumed (mirrors
// consumeResetToken's updateMany claim idiom). Idempotent for the caller: a second click yields null.
export async function consumeVerificationToken(raw: string): Promise<string | null> {
  const tokenHash = hashToken(raw);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.emailVerificationToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const row = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    // stamp verification in the same tx — the claim above guarantees exactly one caller reaches here
    await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    return row.userId;
  });
}
