import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const hash = (value: string) => createHash('sha256').update(value).digest();

export function createCredential(prefix = 'athy'): {
  secret: string;
  prefix: string;
  secretHash: string;
} {
  const token = randomBytes(32).toString('base64url');
  const visiblePrefix = `${prefix}_${token.slice(0, 8)}`;
  const secret = `${visiblePrefix}.${token}`;
  return { secret, prefix: visiblePrefix, secretHash: hash(secret).toString('hex') };
}

export function verifyCredential(secret: string, expectedHex: string): boolean {
  const actual = hash(secret);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
