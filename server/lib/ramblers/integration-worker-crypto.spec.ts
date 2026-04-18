import expect from "expect";
import { describe, it } from "mocha";
import {
  decryptRamblersUploadPayload,
  encryptRamblersUploadPayload,
  signRamblersUploadBody,
  verifyRamblersUploadSignature
} from "./integration-worker-crypto";

describe("integrationWorkerCrypto", () => {
  it("encrypts and decrypts upload credentials", () => {
    const secret = "worker-secret";
    const credentials = {
      userName: "nick@example.com",
      password: "top-secret"
    };

    const encrypted = encryptRamblersUploadPayload(credentials, secret);
    const decrypted = decryptRamblersUploadPayload<typeof credentials>(encrypted, secret);

    expect(decrypted).toEqual(credentials);
  });

  it("signs and verifies request payloads", () => {
    const secret = "shared-secret";
    const body = JSON.stringify({ jobId: "job-123" });
    const signature = signRamblersUploadBody(body, secret);

    expect(verifyRamblersUploadSignature(body, secret, signature)).toEqual(true);
    expect(verifyRamblersUploadSignature(body, secret, `${signature}x`)).toEqual(false);
    expect(verifyRamblersUploadSignature(`${body}x`, secret, signature)).toEqual(false);
  });
});
