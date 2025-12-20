import { actorCalled, engage } from "@serenity-js/core";
import { Navigate } from "@serenity-js/web";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { CancelWalks } from "../screenplay/tasks/ramblers/walks/cancel-walks";
import { UncancelWalks } from "../screenplay/tasks/ramblers/walks/uncancel-walks";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/delete-walks";
import { Publish } from "../screenplay/tasks/ramblers/walks/publish";
import { Unpublish } from "../screenplay/tasks/ramblers/walks/unpublish";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/upload-walks";
import { SelectWalks } from "../screenplay/tasks/ramblers/walks/select-walks";
import { Actors } from "./config/actors";
import { after, beforeEach, describe, it } from "mocha";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNow } from "../../shared/dates";
import { DateFormat } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { CheckAndReportOn } from "../screenplay/tasks/ramblers/walks/check-and-report-on";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";
import { RequestParameterExtractor } from "../screenplay/tasks/ramblers/common/request-parameter-extractor";

const debugLog = debug(envConfig.logNamespace("serenity-walks-upload"));
debugLog.enabled = false;
const actor = "Walks Admin";
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
    const today = dateTimeNow().startOf("day").toFormat(DateFormat.WALKS_MANAGER_API);
    const params = RequestParameterExtractor.extract();

    const steps: any[] = [
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      Navigate.to(`https://walks-manager.ramblers.org.uk/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${today}&d[max]=&rauid=all`),
    ];

    if ((params.walkUploads?.length || 0) > 0) {
      steps.push(
        SelectWalks.byDateAndTitle(params.walkUploads),
        Unpublish.selectedWalks()
      );
    }

    if ((params.walkCount || 0) > 0 || (params.walkDeletions?.length || 0) > 0) {
      steps.push(DeleteWalks.unpublishedOrWithIdsSupplied());
    }

    steps.push(
      CancelWalks.withIdsSupplied(),
      UncancelWalks.withIdsSupplied(),
    );

    if ((params.walkCount || 0) > 0) {
      steps.push(
        UploadWalks.requested(),
        CheckAndReportOn.uploadErrors(),
        Publish.walksInDraftState()
      );
    }

    return actorCalled(actor).attemptsTo(
      ...steps
    );
  });
});
