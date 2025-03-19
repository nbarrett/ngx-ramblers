import { Actor, Cast } from "@serenity-js/core";
import { protractor } from "protractor";
import { BrowseTheWebWithProtractor } from "@serenity-js/protractor";
import { BrowseTheWebWithWebdriverIO } from "@serenity-js/webdriverio";
import { browser } from "@wdio/globals";

export class Actors extends Cast {
  prepare(actor: Actor): Actor {
    if (process.env.WEBDRIVER_FRAMEWORK === "protractor") {
      return actor.whoCan(BrowseTheWebWithProtractor.using(protractor.browser));
    } else {
      return actor.whoCan(BrowseTheWebWithWebdriverIO.using(browser));
    }
  }
}
