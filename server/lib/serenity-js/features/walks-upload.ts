import { actorCalled, engage } from "@serenity-js/core";
import { Navigate } from "@serenity-js/web";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/delete-walks";
import { Publish } from "../screenplay/tasks/ramblers/walks/publish";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/upload-walks";
import { Actors } from "./config/actors";
import { after, beforeEach, describe, it } from "mocha";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { momentNow } from "../../shared/dates";
import { CheckAndReportOn } from "../screenplay/tasks/ramblers/walks/check-and-report-on";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";

const debugLog = debug(envConfig.logNamespace("serenity-walks-upload"));
debugLog.enabled = false;
const actor = process.env["RAMBLERS_USER"] || "Walks Admin";
debugLog("About to run Walks Upload scenario for", actor);

describe("Walks Upload", () => {
  beforeEach(() => {
    debugLog("Engaging actors");
    engage(new Actors());
  });

  after(() => {
    actorCalled(actor).attemptsTo(SaveBrowserSource.toFile("after-all.html"));
  });

  it(`Walks Upload to Ramblers Walks Manager`, () => {
    const today = momentNow().startOf("day").format("YYYY-MM-DD");
    return actorCalled(actor).attemptsTo(
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      Navigate.to(`https://walks-manager.ramblers.org.uk/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${today}&d[max]=&rauid=all`),
      DeleteWalks.unpublishedOrWithIdsSupplied(),
      UploadWalks.requested(),
      CheckAndReportOn.uploadErrors(),
      Publish.walksInDraftState());
  });
});
