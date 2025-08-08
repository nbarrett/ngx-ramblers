import { Actor, Cast, TakeNotes } from "@serenity-js/core";
import { BrowseTheWebWithWebdriverIO } from "@serenity-js/webdriverio";
import { browser } from "@wdio/globals";
import { RamblersUploadAudit } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

export class Actors extends Cast {
  prepare(actor: Actor): Actor {
      return actor.whoCan(BrowseTheWebWithWebdriverIO.using(browser)).whoCan(TakeNotes.usingAnEmptyNotepad<RamblersUploadAudit>());
  }
}
