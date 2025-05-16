import type { WebdriverIOConfig } from "@serenity-js/webdriverio";
import { Duration } from "@serenity-js/core";
import { browser } from "@wdio/globals";
import { ConsoleReporter } from "@serenity-js/console-reporter";
import { DomainEventPublisher } from "./lib/serenity-js/screenplay/crew/DomainEventPublisher";

const featuresDirectory = "lib/serenity-js/features";
const outputDirectory = "target/site/serenity";
const TWO_MINUTES_IN_MILLIS = 2 * 600 * 1000;
export const config: WebdriverIOConfig = {
  framework: "@serenity-js/webdriverio",
  serenity: {
    runner: "mocha",
    crew: [
      ConsoleReporter.forDarkTerminals(),
      DomainEventPublisher.withDefaults(),
      ["@serenity-js/serenity-bdd", {specDirectory: featuresDirectory}],
      ["@serenity-js/web:Photographer", {strategy: "TakePhotosOfFailures"}],
      ["@serenity-js/core:ArtifactArchiver", {outputDirectory}],
    ],
    interactionTimeout: Duration.ofSeconds(20),
    cueTimeout: Duration.ofSeconds(20),
  },
  outputDir: outputDirectory,
  specs: [
    featuresDirectory + "/" + (process.env.RAMBLERS_FEATURE || "walks-upload.ts")
  ],
  exclude: [],
  maxInstances: 1,
  capabilities: [{

    browserName: "chrome",
    browserVersion: process.env.CHROME_VERSION,
    acceptInsecureCerts: true,
    "goog:chromeOptions": {
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-infobars",
        "--headless",
        "--log-level=ALL",
        "--no-sandbox",
        "--window-size=2056x1329",
      ]
    }
  }],
  logLevel: "info",
  bail: 0,
  baseUrl: process.env.BASE_URL,
  waitforTimeout: TWO_MINUTES_IN_MILLIS,
  connectionRetryTimeout: TWO_MINUTES_IN_MILLIS,
  connectionRetryCount: 3,
  reporters: [
    "spec",
  ],

  mochaOpts: {
    ui: "bdd",
    timeout: TWO_MINUTES_IN_MILLIS,
    reporterOptions: {
      specDirectory: featuresDirectory
    },
  },

  async before() {
    await browser.setWindowSize(2056, 1329);
  }
};
