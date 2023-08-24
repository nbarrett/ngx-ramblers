const path = require('path'),
  {ConsoleReporter} = require('@serenity-js/console-reporter'),
  {ArtifactArchiver} = require("@serenity-js/core"),
  {Photographer, TakePhotosOfFailures} = require('@serenity-js/protractor'),
  {SerenityBDDReporter} = require("@serenity-js/serenity-bdd");

exports.config = {
  chromeDriver: process.env["CHROMEDRIVER_PATH"] || require('chromedriver/lib/chromedriver').path,
  SELENIUM_PROMISE_MANAGER: false,
  directConnect: true,
  baseUrl: "https://ekwg-dev.herokuapp.com",
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
      browser: "SEVERE" // "OFF", "SEVERE", "WARNING", "INFO", "CONFIG", "FINE", "FINER", "FINEST", "ALL".
    },

    chromeOptions: {
      binary: process.env["GOOGLE_CHROME_BIN"],
      args: [
        "--no-sandbox",
        "--disable-infobars",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--log-level=3",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--headless",
      ],
    },

    shardTestFiles: false,
    maxInstances: 1,
  },

  disableChecks: true,
  ignoreUncaughtExceptions: true,
  debug: true,
  restartBrowserBetweenTests: false,

  onPrepare: function () {
    browser.waitForAngularEnabled(false);
  },

};
