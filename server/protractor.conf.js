const path = require("path"),
  { ConsoleReporter } = require("@serenity-js/console-reporter"),
  { ArtifactArchiver } = require("@serenity-js/core"),
  { Photographer, TakePhotosOfFailures } = require("@serenity-js/protractor"),
  { SerenityBDDReporter } = require("@serenity-js/serenity-bdd");

exports.config = {
  chromeDriver: process.env["CHROMEDRIVER_PATH"],
  SELENIUM_PROMISE_MANAGER: false,
  directConnect: true,
  baseUrl: process.env["BASE_URL"],
  allScriptsTimeout: 110000,
  getPageTimeout: 60000,

  specs: [
    "serenity-js/features/" + (process.env["RAMBLERS_FEATURE"] || "walks-upload.ts"),
  ],

  framework: "custom",
  frameworkPath: require.resolve("@serenity-js/protractor/adapter"),

  serenity: {
    runner: "jasmine",
    crew: [
      ArtifactArchiver.storingArtifactsAt("./target/site/serenity"),
      Photographer.whoWill(TakePhotosOfFailures),
      new SerenityBDDReporter(),
      ConsoleReporter.withDefaultColourSupport(),
    ]
  },

  jasmineNodeOpts: {
    requires: [
      "ts-node/register",
      path.resolve(__dirname, "node_modules/@serenity-js/jasmine"),
    ],
    helpers: [
      "serenity-js/features/config/*.ts"
    ]
  },

  capabilities: {
    browserName: "chrome",
    loggingPrefs: {
      driver: "INFO",
      browser: "INFO",
    },
    chromeOptions: {
      args: [
        "--headless",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--remote-debugging-port=9222",
        "--window-size=1280,800",
        "user-data-dir=/tmp/user_data",
        "--log-level=ALL",
        "--log-path=/tmp/user_data/chrome.log"
      ],
      binary: process.env.CHROME_BIN,
    }
  },

  shardTestFiles: false,
  maxInstances: 1,

  disableChecks: true,
  ignoreUncaughtExceptions: true,
  debug: true,
  restartBrowserBetweenTests: false,

  onPrepare: function () {
    browser.waitForAngularEnabled(false);
  },
};
