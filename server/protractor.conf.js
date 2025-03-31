const {Duration} = require('@serenity-js/core');
const featuresDirectory = "lib/serenity-js/features";
const outputDirectory = "target/site/serenity";
const TWO_MINUTES_IN_MILLIS = 2 * 600 * 1000;
const FIVE_MINUTES_IN_MILLIS = 5 * 600 * 1000;
exports.config = {
  chromeDriver: process.env.CHROMEDRIVER_PATH,
  SELENIUM_PROMISE_MANAGER: false,
  directConnect: true,
  baseUrl: process.env.BASE_URL,
  allScriptsTimeout: FIVE_MINUTES_IN_MILLIS,
  getPageTimeout: TWO_MINUTES_IN_MILLIS,

  specs: [
    featuresDirectory + "/" + (process.env.RAMBLERS_FEATURE || "walks-upload.ts"),
  ],

  framework: "custom",
  frameworkPath: require.resolve("@serenity-js/protractor/adapter"),

  serenity: {
    runner: "mocha",
    crew: [
      "@serenity-js/console-reporter",
      ["@serenity-js/serenity-bdd", {specDirectory: featuresDirectory}],
      ["@serenity-js/web:Photographer", {strategy: "TakePhotosOfFailures"}],
      ["@serenity-js/core:ArtifactArchiver", {outputDirectory}]
    ],
    interactionTimeout: Duration.ofSeconds(20),
    cueTimeout: Duration.ofSeconds(20),
  },

  mochaOpts: {
    require: [
      "ts-node/register",
    ],
    timeout: FIVE_MINUTES_IN_MILLIS,
  },

  capabilities: {
    browserName: "chrome",
    chromeOptions: {
      binary: process.env.CHROME_BIN,
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-infobars",
        "--headless",
        "--log-level=ALL",
        "--log-path=/tmp/user_data/chrome.log",
        "--no-sandbox",
        "--remote-debugging-port=9222",
        "--user-data-dir=/tmp/user_data",
        "--window-size=2056x1329",
      ],
    },
    loggingPrefs: {
      driver: "INFO",
      browser: "INFO",
    }
  },

  shardTestFiles: false,
  maxInstances: 1,

  disableChecks: true,
  ignoreUncaughtExceptions: true,
  debug: true,
  restartBrowserBetweenTests: false,

  onPrepare: async function () {
    browser.waitForAngularEnabled(false);
    await browser.driver.manage().window().setSize(2056, 1329);
  },
};
