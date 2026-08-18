import { isRamblersAuditNoise } from "./ramblers-audit-noise";

describe("isRamblersAuditNoise", () => {

  it("keeps a real step", () => {
    expect(isRamblersAuditNoise("Scenario execution complete [0m 45s (45472ms)]")).toEqual(false);
    expect(isRamblersAuditNoise("OS Maps login was rejected: Wrong email or password.")).toEqual(false);
  });

  it("drops playwright leftover lines", () => {
    expect(isRamblersAuditNoise("1 failed")).toEqual(true);
    expect(isRamblersAuditNoise("Usage:")).toEqual(true);
    expect(isRamblersAuditNoise("npx playwright show-trace target/site/playwright/os-maps-export.ts-OS-Maps--93009-s-GPX-and-validate-the-file/trace.zip")).toEqual(true);
    expect(isRamblersAuditNoise("attachment #3: trace (application/zip)")).toEqual(true);
    expect(isRamblersAuditNoise("Error Context: target/site/playwright/os-maps-export.ts-OS-Maps--93009-s-GPX-and-validate-the-file/error-context.md")).toEqual(true);
    expect(isRamblersAuditNoise("lib/serenity-js/features/os-maps-export.ts:60:7 › OS Maps GPX export › should login, export Requested OS Maps route (0) as GPX and validate the file")).toEqual(true);
    expect(isRamblersAuditNoise("at /Users/nick/dev/git-personal/ngx-ramblers/server/lib/serenity-js/features/os-maps-export.ts:63:7")).toEqual(true);
    expect(isRamblersAuditNoise("at PerformActivitiesAsPlaywrightSteps.perform (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/playwright-test/src/index.ts:1:1)")).toEqual(true);
    expect(isRamblersAuditNoise("--------------------------------")).toEqual(true);
    expect(isRamblersAuditNoise("")).toEqual(true);
  });

});
