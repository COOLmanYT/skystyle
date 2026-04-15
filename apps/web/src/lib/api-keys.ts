import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const API_KEY_PREFIX = "sk_live_";
const API_KEY_BYTES = 32;
const SCRYPT_KEYLEN = 64;
const HASH_SALT_BYTES = 16;
const PREVIEW_CHARS = 4;
const HEX_FACTOR = 2;
const SALT_HEX_LENGTH = HASH_SALT_BYTES * HEX_FACTOR;
const HASH_HEX_LENGTH = SCRYPT_KEYLEN * HEX_FACTOR;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
} as const;

export function generateApiKey(): { key: string; preview: string } {
  const token = randomBytes(API_KEY_BYTES).toString("base64url");
  const key = `${API_KEY_PREFIX}${token}`;
  return { key, preview: `${API_KEY_PREFIX}${token.slice(0, PREVIEW_CHARS)}` };
}

export function hashApiKey(apiKey: string): string {
  const salt = randomBytes(HASH_SALT_BYTES).toString("hex");
  const hash = scryptSync(apiKey, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyApiKey(apiKey: string, storedHash: string): boolean {
  const match = new RegExp(`^([a-f0-9]{${SALT_HEX_LENGTH}}):([a-f0-9]{${HASH_HEX_LENGTH}})$`).exec(storedHash);
  const salt = match?.[1] ?? "0".repeat(SALT_HEX_LENGTH);
  const expectedHash = match?.[2] ?? "0".repeat(HASH_HEX_LENGTH);
  const computedHash = scryptSync(apiKey, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString("hex");
  const hashesMatch = timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(expectedHash, "hex"));
  return Boolean(match && hashesMatch);
}
