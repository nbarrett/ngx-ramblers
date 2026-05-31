import crypto from "node:crypto";
import { envConfig } from "../env-config/env-config";

function toUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function concatenate(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((total, array) => total + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach(array => {
    result.set(array, offset);
    offset += array.length;
  });
  return result;
}

function key(): Uint8Array {
  return toUint8Array(crypto.createHash("sha256").update(envConfig.auth().secret).digest());
}

export function encryptInboxRefreshToken(refreshToken: string): string {
  const iv = toUint8Array(crypto.randomBytes(12));
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = concatenate(toUint8Array(cipher.update(refreshToken, "utf8")), toUint8Array(cipher.final()));
  const authTag = toUint8Array(cipher.getAuthTag());
  return Buffer.from(concatenate(iv, authTag, encrypted)).toString("base64");
}

export function decryptInboxRefreshToken(encryptedRefreshToken: string): string {
  const encrypted = toUint8Array(Buffer.from(encryptedRefreshToken, "base64"));
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = concatenate(toUint8Array(decipher.update(ciphertext)), toUint8Array(decipher.final()));
  return Buffer.from(decrypted).toString("utf8");
}
