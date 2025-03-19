import type { WebdriverIOConfig } from "@serenity-js/webdriverio";

const headless = process.env.HEADLESS;
const featuresDirectory = "lib/serenity-js/features";
export const config: WebdriverIOConfig = {

  framework: "@serenity-js/webdriverio",

  serenity: {
    runner: "mocha",
    crew: [
      "@serenity-js/console-reporter",
      ["@serenity-js/serenity-bdd", {specDirectory: "test/specs"}],
      ["@serenity-js/web:Photographer", {strategy: "TakePhotosOfInteractions"}],
      // [ '@serenity-js/web:Photographer',   { strategy: 'TakePhotosOfFailures'        } ],
      ["@serenity-js/core:ArtifactArchiver", {outputDirectory: "target/site/serenity"}],
    ]
  },
  outputDir: "target/logs",
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
        "--disable-web-security",
        "--allow-file-access-from-files",
        "--allow-file-access",
        "--disable-infobars",
        "--ignore-certificate-errors",
        "--disable-gpu",
        "--window-size=1024x768",
      ].concat(headless ? ["--headless"] : []),
    }
  }],
  logLevel: "info",

  bail: 0,
  baseUrl: process.env["BASE_URL"],
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  reporters: [
    "spec",
  ],

  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
    reporterOptions: {
      specDirectory: featuresDirectory
    },
  }
};
