import expect from "expect";
import { describe, it } from "mocha";
import { readFileSync } from "fs";
import { resolveClientPath } from "../shared/path-utils";
import { nativeMailTlsConfiguration, withMailClientTlsConfiguration } from "./mail-client-tls-config";

describe("mail TLS deployment scope", () => {
  it("changes only the mail TLS handlers for an explicitly enabled deployment", () => {
    const original = readFileSync(resolveClientPath("fly.toml"), "utf8");
    const updated = nativeMailTlsConfiguration(original);
    expect(updated.split("handlers = []")).toHaveLength(3);
    expect(updated.split("[[services]]")[0]).toBe(original.split("[[services]]")[0]);
    expect(updated.replaceAll("handlers = []", "handlers = [\"tls\"]")).toBe(original);
  });

  it("uses the original deployment configuration when native mail TLS is disabled", async () => {
    const paths: string[] = [];
    await withMailClientTlsConfiguration("fictional-fly.toml", false, async source => {paths.push(source);});
    expect(paths).toEqual(["fictional-fly.toml"]);
  });
});
