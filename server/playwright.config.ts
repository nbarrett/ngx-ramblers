import { defineConfig } from "@playwright/test";
import type { SerenityFixtures, SerenityWorkerFixtures } from "@serenity-js/playwright-test";
import { ConsoleReporter } from "@serenity-js/console-reporter";
import { Environment } from "../projects/ngx-ramblers/src/app/models/environment.model";
import { DEFAULT_WAIT_TIMEOUT } from "./lib/serenity-js/config/serenity-timeouts";

const featuresDirectory = "./lib/serenity-js/features";
const outputDirectory = "target/site/serenity";
const TWO_MINUTES_IN_MILLIS = 2 * 60 * 1000;
const TWENTY_MINUTES_IN_MILLIS = 20 * 60 * 1000;
const selectedFeature = process.env[Environment.RAMBLERS_FEATURE] || "*.ts";
const testMatch = selectedFeature.includes("/") ? selectedFeature : `**/${ selectedFeature }`;
const headless = !["0", "false", "no"].includes((process.env.PLAYWRIGHT_HEADLESS || "true").toLowerCase());

export default defineConfig<SerenityFixtures, SerenityWorkerFixtures>({
  testDir: featuresDirectory,
  testMatch,
  fullyParallel: false,
  workers: 1,
  timeout: TWENTY_MINUTES_IN_MILLIS,
  outputDir: "target/site/playwright",
  reporter: [
    ["@serenity-js/playwright-test", {
      crew: [
        ConsoleReporter.forDarkTerminals(),
        ["@serenity-js/serenity-bdd", { specDirectory: featuresDirectory }],
        ["@serenity-js/web:Photographer", { strategy: "TakePhotosOfFailures" }],
        ["@serenity-js/core:ArtifactArchiver", { outputDirectory }]
      ]
    }],
    ["./lib/serenity-js/reporters/realtime-step-reporter.ts"],
    ["list"]
  ],
  use: {
    acceptDownloads: true,
    actionTimeout: DEFAULT_WAIT_TIMEOUT.inMilliseconds(),
    baseURL: process.env[Environment.BASE_URL],
    cueTimeout: DEFAULT_WAIT_TIMEOUT,
    interactionTimeout: DEFAULT_WAIT_TIMEOUT,
    headless,
    ignoreHTTPSErrors: true,
    navigationTimeout: TWO_MINUTES_IN_MILLIS,
    trace: "retain-on-failure",
    viewport: {
      width: 2056,
      height: 1329
    },
    launchOptions: {
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-infobars",
        "--log-level=ALL",
        "--no-sandbox"
      ]
    }
  }
});
