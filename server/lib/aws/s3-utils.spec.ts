import expect from "expect";
import { describe, it } from "mocha";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { uploadDirectoryToS3 } from "./s3-utils";

interface CapturedPut {
  Bucket: string;
  Key: string;
  ContentType: string;
  Body: Buffer;
}

interface StubResult {
  client: S3Client;
  puts: CapturedPut[];
  inFlightPeak: () => number;
}

function makeStubClient(options: { delayMs?: number; failOnKey?: string } = {}): StubResult {
  const puts: CapturedPut[] = [];
  let inFlight = 0;
  let peak = 0;
  const send = async (command: any): Promise<any> => {
    if (!(command instanceof PutObjectCommand)) {
      throw new Error("Unexpected command: " + command?.constructor?.name);
    }
    const input = command.input as CapturedPut;
    inFlight++;
    if (inFlight > peak) {
      peak = inFlight;
    }
    try {
      if (options.delayMs) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
      if (options.failOnKey && input.Key === options.failOnKey) {
        throw new Error("simulated failure for " + input.Key);
      }
      puts.push({
        Bucket: input.Bucket,
        Key: input.Key,
        ContentType: input.ContentType,
        Body: input.Body as Buffer
      });
      return {};
    } finally {
      inFlight--;
    }
  };
  const client = { send } as unknown as S3Client;
  return { client, puts, inFlightPeak: () => peak };
}

async function makeTempDir(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "s3-utils-spec-"));
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
  return root;
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

describe("uploadDirectoryToS3", () => {
  it("uploads all files recursively with correct keys and content types", async () => {
    const dir = await makeTempDir({
      "index.html": "<html></html>",
      "assets/app.js": "console.log(1);",
      "assets/nested/styles.css": "body {}"
    });
    const { client, puts } = makeStubClient();
    try {
      await uploadDirectoryToS3(client, dir, "my-bucket", "reports/run-1");
    } finally {
      await removeDir(dir);
    }
    const byKey = new Map(puts.map(p => [p.Key, p]));
    expect(puts.length).toEqual(3);
    expect(byKey.get("reports/run-1/index.html")?.ContentType).toEqual("text/html; charset=utf-8");
    expect(byKey.get("reports/run-1/assets/app.js")?.ContentType).toEqual("application/javascript; charset=utf-8");
    expect(byKey.get("reports/run-1/assets/nested/styles.css")?.ContentType).toEqual("text/css; charset=utf-8");
    for (const put of puts) {
      expect(put.Bucket).toEqual("my-bucket");
    }
  });

  it("uploads in parallel up to the concurrency cap", async () => {
    const files: Record<string, string> = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`file-${i}.txt`, `content-${i}`])
    );
    const dir = await makeTempDir(files);
    const { client, puts, inFlightPeak } = makeStubClient({ delayMs: 30 });
    const start = Date.now();
    try {
      await uploadDirectoryToS3(client, dir, "bucket", "prefix", undefined, 2);
    } finally {
      await removeDir(dir);
    }
    const elapsed = Date.now() - start;
    expect(puts.length).toEqual(10);
    expect(inFlightPeak()).toBeLessThanOrEqual(2);
    expect(inFlightPeak()).toBeGreaterThanOrEqual(2);
    expect(elapsed).toBeLessThan(260);
  });

  it("rejects the overall promise when a single upload fails", async () => {
    const dir = await makeTempDir({
      "a.txt": "a",
      "b.txt": "b",
      "c.txt": "c"
    });
    const { client } = makeStubClient({ delayMs: 5, failOnKey: "out/b.txt" });
    let error: unknown = undefined;
    try {
      await uploadDirectoryToS3(client, dir, "bucket", "out", undefined, 1);
    } catch (e) {
      error = e;
    } finally {
      await removeDir(dir);
    }
    expect(error).toBeDefined();
    expect(String(error)).toMatch(/simulated failure for out\/b\.txt/);
  });

  it("invokes the progress callback once per uploaded file", async () => {
    const dir = await makeTempDir({
      "one.txt": "1",
      "two.txt": "2",
      "sub/three.txt": "3"
    });
    const { client } = makeStubClient();
    const keys: string[] = [];
    try {
      await uploadDirectoryToS3(client, dir, "bucket", "p", (_bucket, key) => {
        keys.push(key);
      });
    } finally {
      await removeDir(dir);
    }
    expect(keys.sort()).toEqual(["p/one.txt", "p/sub/three.txt", "p/two.txt"]);
  });
});
