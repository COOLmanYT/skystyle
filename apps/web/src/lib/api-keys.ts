import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "crypto";

export const API_KEY_PREFIX = "sk_live_";
export const API_KEY_PREVIEW_LENGTH = API_KEY_PREFIX.length + 4; // "sk_live_" + 4 random chars
const API_KEY_BYTES = 32;
const SCRYPT_KEYLEN = 64;
const HASH_SALT_BYTES = 16;
const PREVIEW_CHARS = 4;
const HEX_FACTOR = 2;
const SALT_HEX_LENGTH = HASH_SALT_BYTES * HEX_FACTOR;
const HASH_HEX_LENGTH = SCRYPT_KEYLEN * HEX_FACTOR;
const STORED_HASH_REGEX = new RegExp(`^([a-f0-9]{${SALT_HEX_LENGTH}}):([a-f0-9]{${HASH_HEX_LENGTH}})$`);
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

export async function verifyApiKey(apiKey: string, storedHash: string): Promise<boolean> {
  const match = STORED_HASH_REGEX.exec(storedHash);
  // If the stored hash is malformed, reject immediately — no scrypt needed
  if (!match) return false;
  const [, salt, expectedHash] = match;
  const computedHash = await new Promise<string>((resolve, reject) => {
    scrypt(apiKey, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString("hex"));
    });
  });
  return timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(expectedHash, "hex"));
}
