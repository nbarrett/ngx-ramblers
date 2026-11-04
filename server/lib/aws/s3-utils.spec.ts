import {fromPairs, toPairs} from "es-toolkit/compat";
import expect from "expect";
import {describe, it} from "mocha";
import * as fs from "fs/promises";
import {ReadStream} from "fs";
import * as os from "os";
import * as path from "path";
import {PutObjectCommand, PutObjectCommandInput, S3Client} from "@aws-sdk/client-s3";
import {uploadDirectoryToS3} from "./s3-utils";

function makeStubClient(options: {failOnKey?: string} = {}) {
  const puts: PutObjectCommandInput[] = [];
  const streams: ReadStream[] = [];
  const state = {inFlight: 0, peak: 0};
  const send = async (command: PutObjectCommand) => {
    expect(command).toBeInstanceOf(PutObjectCommand);
    const input = command.input;
    const body = input.Body as ReadStream;
    expect(body).toBeInstanceOf(ReadStream);
    streams.push(body);
    state.inFlight++;
    state.peak = Math.max(state.peak, state.inFlight);
    try {
      if (options.failOnKey && input.Key === options.failOnKey) {
        throw new Error("simulated failure for " + input.Key);
      } else {
        const chunks: Uint8Array[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        puts.push({...input, Body: Buffer.concat(chunks)});
        return {};
      }
    } finally {
      state.inFlight--;
    }
  };
  return {client: {send} as unknown as S3Client, puts, streams, inFlightPeak: () => state.peak};
}

async function makeTempDir(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "s3-utils-spec-"));
  for (const [relative, content] of toPairs(files)) {
    const full = path.join(root, relative);
    await fs.mkdir(path.dirname(full), {recursive: true});
    await fs.writeFile(full, content);
  }
  return root;
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, {recursive: true, force: true});
}

describe("uploadDirectoryToS3", () => {
  it("streams all files recursively with correct keys, content types, lengths and bytes", async () => {
    const files = {"index.html": "<html></html>", "assets/app.js": "document.title = 1;", "assets/nested/styles.css": "body {}"};
    const dir = await makeTempDir(files);
    const {client, puts, streams, inFlightPeak} = makeStubClient();
    try {
      await uploadDirectoryToS3(client, dir, "example-bucket", "reports/run-1");
    } finally {
      await removeDir(dir);
    }
    const byKey = new Map(puts.map(put => [put.Key, put]));
    expect(puts).toHaveLength(3);
    expect(byKey.get("reports/run-1/index.html")?.ContentType).toBe("text/html; charset=utf-8");
    expect(byKey.get("reports/run-1/assets/app.js")?.ContentType).toBe("application/javascript; charset=utf-8");
    expect(byKey.get("reports/run-1/assets/nested/styles.css")?.ContentType).toBe("text/css; charset=utf-8");
    for (const [name, content] of toPairs(files)) {
      const put = byKey.get(`reports/run-1/${name}`);
      expect(put.Bucket).toBe("example-bucket");
      expect(put.ContentLength).toBe(Buffer.byteLength(content));
      expect((put.Body as Buffer).toString()).toBe(content);
    }
    expect(inFlightPeak()).toBe(1);
    expect(streams.every(stream => stream.destroyed)).toBe(true);
  });

  it("uploads in parallel only up to an explicit concurrency cap", async () => {
    const files = fromPairs(Array.from({length: 10}, (_value, index) => [`file-${index}.txt`, `content-${index}`]));
    const dir = await makeTempDir(files);
    const {client, puts, inFlightPeak} = makeStubClient();
    try {
      await uploadDirectoryToS3(client, dir, "example-bucket", "prefix", null, 2);
    } finally {
      await removeDir(dir);
    }
    expect(puts).toHaveLength(10);
    expect(inFlightPeak()).toBe(2);
  });

  it("stops after an upload fails and destroys each failed attempt's stream", async () => {
    const dir = await makeTempDir({"a.txt": "a", "b.txt": "b", "c.txt": "c"});
    const {client, puts, streams} = makeStubClient({failOnKey: "out/b.txt"});
    try {
      await expect(uploadDirectoryToS3(client, dir, "example-bucket", "out")).rejects.toThrow("simulated failure for out/b.txt");
    } finally {
      await removeDir(dir);
    }
    expect(puts.map(put => put.Key)).toEqual(["out/a.txt"]);
    expect(streams).toHaveLength(4);
    expect(streams.every(stream => stream.destroyed)).toBe(true);
  });

  it("reopens the file when retrying instead of reusing an exhausted stream", async () => {
    const dir = await makeTempDir({"one.txt": "retry content"});
    const streams: ReadStream[] = [];
    const send = async (command: PutObjectCommand) => {
      const body = command.input.Body as ReadStream;
      streams.push(body);
      if (streams.length === 1) {
        throw new Error("temporary network failure");
      } else {
        const chunks: Uint8Array[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        expect(Buffer.concat(chunks).toString()).toBe("retry content");
        return {};
      }
    };
    const completed: string[] = [];
    try {
      await uploadDirectoryToS3({send} as unknown as S3Client, dir, "example-bucket", "prefix", async (_bucket, key) => {
        completed.push(key);
      });
    } finally {
      await removeDir(dir);
    }
    expect(streams).toHaveLength(2);
    expect(streams[0]).not.toBe(streams[1]);
    expect(streams.every(stream => stream.destroyed)).toBe(true);
    expect(completed).toEqual(["prefix/one.txt"]);
  });

  it("reads a large dump in bounded chunks rather than buffering the file", async () => {
    const dir = await makeTempDir({});
    const size = 128 * 1024 * 1024;
    const file = await fs.open(path.join(dir, "large.bson.gz"), "w");
    try {
      await file.truncate(size);
    } finally {
      await file.close();
    }
    const observed = {bytes: 0, largestChunk: 0};
    const send = async (command: PutObjectCommand) => {
      expect(command.input.ContentLength).toBe(size);
      const body = command.input.Body as ReadStream;
      expect(body).toBeInstanceOf(ReadStream);
      for await (const chunk of body) {
        observed.bytes += chunk.length;
        observed.largestChunk = Math.max(observed.largestChunk, chunk.length);
      }
      return {};
    };
    try {
      await uploadDirectoryToS3({send} as unknown as S3Client, dir, "example-bucket", "prefix");
    } finally {
      await removeDir(dir);
    }
    expect(observed.bytes).toBe(size);
    expect(observed.largestChunk).toBeLessThanOrEqual(64 * 1024);
  });

  it("awaits the progress callback once per successfully uploaded file", async () => {
    const dir = await makeTempDir({"one.txt": "1", "two.txt": "2", "sub/three.txt": "3"});
    const {client} = makeStubClient();
    const keys: string[] = [];
    try {
      await uploadDirectoryToS3(client, dir, "example-bucket", "prefix", async (_bucket, key) => {
        await Promise.resolve();
        keys.push(key);
      });
    } finally {
      await removeDir(dir);
    }
    expect(keys.sort()).toEqual(["prefix/one.txt", "prefix/sub/three.txt", "prefix/two.txt"]);
  });
});
