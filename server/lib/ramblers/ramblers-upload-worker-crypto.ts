import crypto from "crypto";

function bytes(value: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function concatBytes(values: (Buffer | Uint8Array)[]): Uint8Array {
  const normalised = values.map(value => bytes(value));
  const totalLength = normalised.reduce((sum, value) => sum + value.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  normalised.forEach(value => {
    combined.set(value, offset);
    offset += value.byteLength;
  });
  return combined;
}

function derivedKey(secret: string): Uint8Array {
  return bytes(crypto.createHash("sha256").update(secret).digest());
}

export function encryptRamblersUploadPayload<T>(value: T, secret: string): string {
  const iv = bytes(crypto.randomBytes(12));
  const key = derivedKey(secret);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(value);
  const encrypted = concatBytes([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = bytes(cipher.getAuthTag());
  return Buffer.from(concatBytes([iv, authTag, encrypted])).toString("base64");
}

export function decryptRamblersUploadPayload<T>(encryptedValue: string, secret: string): T {
  const combined = Buffer.from(encryptedValue, "base64");
  const iv = bytes(combined.subarray(0, 12));
  const authTag = bytes(combined.subarray(12, 28));
  const ciphertext = bytes(combined.subarray(28));
  const key = derivedKey(secret);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.from(concatBytes([decipher.update(ciphertext), decipher.final()]));
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function signRamblersUploadBody(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyRamblersUploadSignature(body: string, secret: string, signature: string): boolean {
  const expectedSignature = signRamblersUploadBody(body, secret);

  if (!signature || expectedSignature.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    bytes(Buffer.from(expectedSignature, "utf8")),
    bytes(Buffer.from(signature, "utf8"))
  );
}
