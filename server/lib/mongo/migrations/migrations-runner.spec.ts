import expect from "expect";
import { describe, it } from "mocha";
import { isMigrationSourceFile } from "./migrations-runner";

describe("isMigrationSourceFile", () => {
  it("accepts timestamped JavaScript and TypeScript migration files", () => {
    expect(isMigrationSourceFile("20260925190000-repair-inbox.js")).toBe(true);
    expect(isMigrationSourceFile("20260925190000-repair-inbox.ts")).toBe(true);
  });

  it("rejects migration tests and declarations", () => {
    expect(isMigrationSourceFile("20260925190000-repair-inbox.spec.js")).toBe(false);
    expect(isMigrationSourceFile("20260925190000-repair-inbox.spec.ts")).toBe(false);
    expect(isMigrationSourceFile("20260925190000-repair-inbox.d.ts")).toBe(false);
  });

  it("rejects files without a migration timestamp", () => {
    expect(isMigrationSourceFile("repair-inbox.js")).toBe(false);
  });
});
