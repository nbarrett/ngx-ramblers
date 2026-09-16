import expect from "expect";
import { describe, it } from "mocha";
import { registrationFailureMessage, registrationProgressLineFailed, registrationProgressLines, registrationProgressStatus, sanitiseRegistrationMessage } from "../../../projects/ngx-ramblers/src/app/functions/registration-progress";
import { SetupProgress, SetupStepStatus } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";

const PLAYWRIGHT_DUMP = "browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell\nPlease run npx playwright install";
const PLAYWRIGHT_MESSAGE = "The import browser on the integration worker is not ready. Check that the integration worker is running, then retry.";

function line(message: string, status = SetupStepStatus.Running, timestamp = 1): SetupProgress {
  return {step: "Import", status, message, timestamp};
}

describe("sanitiseRegistrationMessage", () => {
  it("replaces Playwright browser-install dumps with a short operator message", () => {
    expect(sanitiseRegistrationMessage(PLAYWRIGHT_DUMP)).toBe(PLAYWRIGHT_MESSAGE);
  });
});

describe("registrationProgressLineFailed", () => {
  it("treats a zero error count as success", () => {
    expect(registrationProgressLineFailed("Imported 12 pages with 0 errors")).toBe(false);
    expect(registrationProgressLineFailed("Finished without errors")).toBe(false);
  });

  it("treats a non-zero error count, a leading Error or Failed, and failure prefixes as failures", () => {
    expect(registrationProgressLineFailed("Imported 12 pages with 3 errors")).toBe(true);
    expect(registrationProgressLineFailed("Error: page not found")).toBe(true);
    expect(registrationProgressLineFailed("Failed to load /about: Status 404")).toBe(true);
    expect(registrationProgressLineFailed("Walks Manager load finished with errors: bad date")).toBe(true);
    expect(registrationProgressLineFailed("❌ Subresource failed")).toBe(true);
  });
});

describe("registrationProgressStatus", () => {
  it("keeps a stored Failed status and marks a zero error count as completed", () => {
    expect(registrationProgressStatus(line("anything", SetupStepStatus.Failed), true)).toBe(SetupStepStatus.Failed);
    expect(registrationProgressStatus(line("Imported 12 pages with 0 errors", SetupStepStatus.Completed), true)).toBe(SetupStepStatus.Completed);
  });

  it("shows a running line as running only while the build is in flight", () => {
    expect(registrationProgressStatus(line("Importing /about"), true)).toBe(SetupStepStatus.Running);
    expect(registrationProgressStatus(line("Importing /about"), false)).toBe(SetupStepStatus.Completed);
    expect(registrationProgressStatus(line("Importing /about"), true, false)).toBe(SetupStepStatus.Completed);
  });
});

describe("registrationProgressLines", () => {
  it("collapses consecutive identical lines, keeps the latest of them and lists newest first", () => {
    const lines = registrationProgressLines([
      line("Creating the review site", SetupStepStatus.Running, 1),
      line(PLAYWRIGHT_DUMP, SetupStepStatus.Failed, 2),
      line(PLAYWRIGHT_DUMP, SetupStepStatus.Failed, 3),
      line(PLAYWRIGHT_MESSAGE, SetupStepStatus.Failed, 4),
      line("Retrying", SetupStepStatus.Running, 5)
    ]);
    expect(lines.map(item => item.timestamp)).toEqual([5, 4, 1]);
  });

  it("drops browser resource noise", () => {
    const lines = registrationProgressLines([line("net::ERR_ABORTED on image"), line("Importing /walks")]);
    expect(lines.map(item => item.message)).toEqual(["Importing /walks"]);
  });

  it("names the stage a build failed in", () => {
    expect(registrationFailureMessage("importing pages from the current website", "Operation timed out"))
      .toEqual("Failed while importing pages from the current website: Operation timed out");
  });
});
