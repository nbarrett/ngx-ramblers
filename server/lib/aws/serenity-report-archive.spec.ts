import AdmZip from "adm-zip";
import expect from "expect";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, it } from "mocha";
import { extractedSerenityReportDirectory } from "./serenity-report-archive";

describe("Serenity report archive extraction", () => {
  const state = {cacheRoot: ""};

  beforeEach(async () => {
    state.cacheRoot = await fs.mkdtemp(path.join(tmpdir(), "serenity-report-test-"));
  });

  afterEach(async () => {
    await fs.rm(state.cacheRoot, {recursive: true, force: true});
  });

  function archive(): Uint8Array {
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html><body>Example report</body></html>"));
    zip.addFile("assets/report.css", Buffer.from("body { color: black; }"));
    return Uint8Array.from(zip.toBuffer());
  }

  it("extracts nested assets, reuses the cache and removes the downloaded archive", async () => {
    const downloads = {count: 0};
    const download = async (_bucket: string, key: string, archivePath: string): Promise<void> => {
      downloads.count += 1;
      expect(key).toBe("reports/example.zip");
      await fs.writeFile(archivePath, archive());
    };
    const directory = await extractedSerenityReportDirectory("example-bucket", "reports/example", download, state.cacheRoot);
    expect(await fs.readFile(path.join(directory, "index.html"), "utf8")).toContain("Example report");
    expect(await fs.readFile(path.join(directory, "assets/report.css"), "utf8")).toContain("black");
    expect(await extractedSerenityReportDirectory("example-bucket", "reports/example", download, state.cacheRoot)).toBe(directory);
    expect(downloads.count).toBe(1);
    expect((await fs.readdir(state.cacheRoot)).filter(name => name.endsWith(".zip"))).toEqual([]);
  });

  it("shares one download and extraction between simultaneous report requests", async () => {
    const downloads = {count: 0};
    const download = async (_bucket: string, _key: string, archivePath: string): Promise<void> => {
      downloads.count += 1;
      await fs.writeFile(archivePath, archive());
    };
    const directories = await Promise.all([1, 2, 3].map(() => extractedSerenityReportDirectory("example-bucket", "reports/example", download, state.cacheRoot)));
    expect(new Set(directories).size).toBe(1);
    expect(downloads.count).toBe(1);
  });

  it("propagates download failures and allows a later retry", async () => {
    await expect(extractedSerenityReportDirectory("example-bucket", "reports/example", async () => {
      throw new Error("Download interrupted");
    }, state.cacheRoot)).rejects.toThrow("Download interrupted");
    const directory = await extractedSerenityReportDirectory("example-bucket", "reports/example", async (_bucket, _key, archivePath) => {
      await fs.writeFile(archivePath, archive());
    }, state.cacheRoot);
    expect(await fs.readFile(path.join(directory, "index.html"), "utf8")).toContain("Example report");
  });

  it("does not cache a corrupt report or retain its temporary archive", async () => {
    await expect(extractedSerenityReportDirectory("example-bucket", "reports/example", async (_bucket, _key, archivePath) => {
      await fs.writeFile(archivePath, "not a zip file");
    }, state.cacheRoot)).rejects.toThrow();
    expect((await fs.readdir(state.cacheRoot)).filter(name => name.endsWith(".zip"))).toEqual([]);
    const directories = await fs.readdir(state.cacheRoot);
    expect(await fs.readdir(path.join(state.cacheRoot, directories[0]))).not.toContain(".ready");
  });
});
