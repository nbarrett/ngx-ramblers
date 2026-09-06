const AUDIT_NOISE_MARKERS = [
  "undefined undefined undefined",
  "DeprecationWarning",
  "mongodb+srv://",
  "env-config using environment variable",
  "Spawning: ",
  "Loading test outcomes",
  "Writing aggregated report",
  "SERENITY COMMAND LINE",
  "> serenity-bdd",
  "> ngx-ramblers@",
  "> playwright",
  "(Use `node --trace-deprecation",
  "Script '",
  "Failed with exit code",
  "Succeeded with exit code 0 as all scripts passed",
  "@playwright/test",
  "@serenity-js/playwright-test",
  "@serenity-js/playwright",
  "Running 1 test using 1 worker",
  "[dotenv@",
  "-------------------------------",
  "Execution Summary",
  "Scenarios:",
  "Real time:",
  "Total time:",
  "============================================================",
  "npx playwright show-trace",
  "playwright show-trace",
  "Error Context:",
  "attachment #",
  "trace.zip",
  "target/site/playwright",
  "error-context.md",
  "lib/serenity-js/features/",
  " › ",
  "at /Users/",
  "at PerformActivities",
  "Usage:"
];

export function isRamblersAuditNoise(message: string | null): boolean {
  if (!message) {
    return true;
  } else {
    const trimmed = message.trim();
    const compact = trimmed.replace(/\s/g, "");
    const reportsAnError = /^\w*Error:/.test(trimmed);
    return trimmed.length <= 2
      || (!reportsAnError && AUDIT_NOISE_MARKERS.some(marker => trimmed.includes(marker)))
      || /^=+$/.test(compact)
      || /^[-_─━—]+$/.test(compact)
      || /^\d+\s+(failed|passed|flaky|skipped)\b/i.test(trimmed)
      || /^Running \d+ tests? using \d+ workers?$/i.test(trimmed)
      || /^>?\s*\d+\s*\|/.test(trimmed)
      || /^\|\s*\^*$/.test(trimmed)
      || /^\[[\w-]+\]$/.test(trimmed)
      || /^at\s+\S/.test(trimmed);
  }
}
