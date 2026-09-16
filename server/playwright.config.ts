import { defineConfig } from "@playwright/test";
import type { SerenityFixtures, SerenityWorkerFixtures } from "@serenity-js/playwright-test";
import { ConsoleReporter } from "@serenity-js/console-reporter";
import { Photographer, TakePhotosOfInteractions } from "@serenity-js/web";
import { TakePhotosOfFailuresWhenThePageSettles } from "./lib/serenity-js/crew/take-photos-of-failures-when-the-page-settles";
import { Environment } from "../projects/ngx-ramblers/src/app/models/environment.model";
import { UK_CENTRE_GEOLOCATION } from "../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { DEFAULT_INTERACTION_TIMEOUT, DEFAULT_WAIT_TIMEOUT } from "./lib/serenity-js/config/serenity-timeouts";
import { resolveHeadless } from "./lib/shared/playwright-browser";
import { asBoolean } from "./lib/shared/string-utils";

const featuresDirectory = "./lib/serenity-js/features";
const outputDirectory = "target/site/serenity";
const TWO_MINUTES_IN_MILLIS = 2 * 60 * 1000;
const TWENTY_MINUTES_IN_MILLIS = 20 * 60 * 1000;
const selectedFeature = process.env[Environment.RAMBLERS_FEATURE] || "*.ts";
const testMatch = selectedFeature.includes("/") ? selectedFeature : `**/${ selectedFeature }`;
const featureRequested = !!process.env[Environment.RAMBLERS_FEATURE];
const headless = resolveHeadless();
const captureEveryInteraction = asBoolean(process.env[Environment.SERENITY_SCREENSHOTS] || false);
const realtimeReportingActive = !!(process.env[Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL]
  && process.env[Environment.INTEGRATION_WORKER_CALLBACK_PROGRESS_PATH]
  && process.env[Environment.INTEGRATION_WORKER_CALLBACK_SECRET]
  && process.env[Environment.INTEGRATION_WORKER_JOB_ID]);

const BLOCKED_HOSTS = [
  "*.amplitude.com",
  "*.qualtrics.com",
  "weather.oscpdata.com",
  "*.google-analytics.com",
  "*.googletagmanager.com",
  "*.doubleclick.net",
  "*.hotjar.com",
  "*.facebook.net"
];

const BLOCKED_HOST_RESOLVER_RULES = BLOCKED_HOSTS.map(host => `MAP ${host} ~NOTFOUND`).join(",");

export default defineConfig<SerenityFixtures, SerenityWorkerFixtures>({
  testDir: featuresDirectory,
  testMatch,
  testIgnore: featureRequested ? [] : ["**/os-maps-*.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: TWENTY_MINUTES_IN_MILLIS,
  outputDir: "target/site/playwright",
  reporter: [
    ["@serenity-js/playwright-test", {
      crew: [
        ...(realtimeReportingActive ? [] : [ConsoleReporter.forDarkTerminals()]),
        ["@serenity-js/serenity-bdd", { specDirectory: featuresDirectory }],
        ["@serenity-js/core:ArtifactArchiver", { outputDirectory }]
      ]
    }],
    ["./lib/serenity-js/reporters/realtime-step-reporter.ts"],
    ["list"]
  ],
  use: {
    crew: [
      Photographer.whoWill(captureEveryInteraction ? TakePhotosOfInteractions : TakePhotosOfFailuresWhenThePageSettles)
    ],
    acceptDownloads: true,
    actionTimeout: DEFAULT_INTERACTION_TIMEOUT.inMilliseconds(),
    baseURL: process.env[Environment.BASE_URL],
    geolocation: UK_CENTRE_GEOLOCATION,
    permissions: ["geolocation"],
    cueTimeout: DEFAULT_WAIT_TIMEOUT,
    interactionTimeout: DEFAULT_INTERACTION_TIMEOUT,
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
        "--no-sandbox",
        `--host-resolver-rules=${BLOCKED_HOST_RESOLVER_RULES}`
      ]
    }
  }
});
