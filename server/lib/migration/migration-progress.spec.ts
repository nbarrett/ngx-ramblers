import expect from "expect";
import { afterEach, describe, it } from "mocha";
import { MigrationCancelledError, assertMigrationNotCancelled, cancelMigration, progress, resetMigrationCancellation, setProgressSender } from "./migration-progress";

describe("migration cancellation", () => {
  afterEach(() => {
    resetMigrationCancellation();
    setProgressSender(null);
  });

  it("stops a running migration at its next progress report once it has been cancelled", () => {
    const messages: string[] = [];
    setProgressSender(data => messages.push(data.message));
    progress("Scraping the first page");
    cancelMigration("Stopped by the platform reviewer.");
    expect(() => progress("Scraping the second page")).toThrow(MigrationCancelledError);
    expect(() => assertMigrationNotCancelled()).toThrow("Stopped by the platform reviewer.");
    expect(messages).toEqual(["Scraping the first page"]);
  });

  it("lets the next migration run after a reset", () => {
    cancelMigration("Stopped");
    resetMigrationCancellation();
    expect(() => progress("Starting again")).not.toThrow();
  });
});
