import crypto from "crypto";

function toUint8Array(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  arrays.reduce((offset, arr) => {
    result.set(arr, offset);
    return offset + arr.length;
  }, 0);
  return result;
}

function deriveKey(secret: string): Uint8Array {
  return toUint8Array(crypto.createHash("sha256").update(secret).digest());
}

export function encryptJsonConfig<T>(config: T, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = toUint8Array(crypto.randomBytes(12));
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(config);
  const part1 = toUint8Array(cipher.update(plaintext, "utf8"));
  const part2 = toUint8Array(cipher.final());
  const encrypted = concatUint8Arrays(part1, part2);
  const authTag = toUint8Array(cipher.getAuthTag());
  const combined = concatUint8Arrays(iv, authTag, encrypted);
  return Buffer.from(combined).toString("base64");
}

export function decryptJsonConfig<T>(encryptedBase64: string, encryptionKey: string): T {
  const key = deriveKey(encryptionKey);
  const combined = toUint8Array(Buffer.from(encryptedBase64, "base64"));
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(12, 28);
  const ciphertext = combined.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decPart1 = toUint8Array(decipher.update(ciphertext));
  const decPart2 = toUint8Array(decipher.final());
  const decrypted = concatUint8Arrays(decPart1, decPart2);
  return JSON.parse(Buffer.from(decrypted).toString("utf8")) as T;
}
