import bcrypt from 'bcryptjs';

const COST = 12;

// computed once at module load; ~250ms startup cost, never repeated
// used in login to equalize timing when user does not exist (D9 — constant-time)
export const DUMMY_HASH = await bcrypt.hash('__dummy__', COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
