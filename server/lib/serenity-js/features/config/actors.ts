import { Actor, Cast, TakeNotes } from "@serenity-js/core";
import { protractor } from "protractor";
import { BrowseTheWebWithProtractor } from "@serenity-js/protractor";
import { BrowseTheWebWithWebdriverIO } from "@serenity-js/webdriverio";
import { browser } from "@wdio/globals";
import { RamblersUploadAudit } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

export class Actors extends Cast {
  prepare(actor: Actor): Actor {
    if (process.env.WEBDRIVER_FRAMEWORK === "protractor") {
      return actor.whoCan(BrowseTheWebWithProtractor.using(protractor.browser)).whoCan(TakeNotes.usingAnEmptyNotepad<RamblersUploadAudit>());
    } else {
      return actor.whoCan(BrowseTheWebWithWebdriverIO.using(browser)).whoCan(TakeNotes.usingAnEmptyNotepad<RamblersUploadAudit>());
    }
  }
}
