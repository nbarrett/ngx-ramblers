import expect from "expect";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { S3 } from "@aws-sdk/client-s3";
import { uploadMigrationBufferToS3 } from "./migration-file-upload";

describe("uploadMigrationBufferToS3", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("tries an upload again when the connection drops, keeping the same file name", async () => {
    sandbox.stub(global, "setTimeout").callsFake(((callback: () => void) => {
      callback();
      return 0;
    }) as any);
    const send = sandbox.stub(S3.prototype, "send");
    send.onFirstCall().rejects(new Error("socket hang up"));
    send.onSecondCall().resolves({} as never);
    const key = await uploadMigrationBufferToS3("review-site", "https://group.example/photo.jpg", Buffer.from("image"));
    expect(send.callCount).toBe(2);
    expect(key).toMatch(/^site-content\/.+\.jpg$/);
    expect((send.firstCall.args[0] as any).input.Key).toEqual((send.secondCall.args[0] as any).input.Key);
  });
});
