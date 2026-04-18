import { Check } from "@serenity-js/core";
import { NavigateWithDomLoaded } from "../screenplay/tasks/common/navigate-with-dom-loaded";
import { equals } from "@serenity-js/assertions";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { CancelWalks } from "../screenplay/tasks/ramblers/walks/cancel-walks";
import { UncancelWalks } from "../screenplay/tasks/ramblers/walks/uncancel-walks";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/delete-walks";
import { Publish } from "../screenplay/tasks/ramblers/walks/publish";
import { Unpublish } from "../screenplay/tasks/ramblers/walks/unpublish";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/upload-walks";
import { SelectWalks } from "../screenplay/tasks/ramblers/walks/select-walks";
import { afterEach, describe, it } from "@serenity-js/playwright-test";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNow } from "../../shared/dates";
import { DateFormat } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { CheckAndReportOn } from "../screenplay/tasks/ramblers/walks/check-and-report-on";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";
import { RequestParameterExtractor } from "../screenplay/tasks/ramblers/common/request-parameter-extractor";
import { RequestParameters } from "../screenplay/questions/ramblers/request-parameters";

const debugLog = debug(envConfig.logNamespace("serenity-walks-upload"));
debugLog.enabled = false;
const actor = "Walks Admin";
debugLog("About to run Walks Upload scenario for", actor);

describe("Walks Upload", () => {
  afterEach(async ({ actorCalled }) => {
    await actorCalled(actor).attemptsTo(SaveBrowserSource.toFile("after-all.html"));
  });

  it(`Walks Upload to Ramblers Walks Manager`, async ({ actorCalled }) => {
    const today = dateTimeNow().startOf("day").toFormat(DateFormat.WALKS_MANAGER_API);
    const params = RequestParameterExtractor.extract();
    const walksAdmin = actorCalled(actor);

    await walksAdmin.attemptsTo(
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      NavigateWithDomLoaded.to(`https://walks-manager.ramblers.org.uk/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${today}&d[max]=&rauid=all`),
      Check.whether(RequestParameters.hasWalkUploads(), equals(true))
        .andIfSo(
          SelectWalks.byDateAndTitle(params.walkUploads),
          Unpublish.selectedWalks()
        ),
      Check.whether(RequestParameters.hasWalkDeletionsOrCount(), equals(true))
        .andIfSo(
          DeleteWalks.unpublishedOrWithIdsSupplied()
        ),
      CancelWalks.withIdsSupplied(),
      UncancelWalks.withIdsSupplied(),
      Check.whether(RequestParameters.hasWalkCount(), equals(true))
        .andIfSo(
          UploadWalks.requested(),
          CheckAndReportOn.uploadErrors(),
          Publish.walksInDraftState()
        )
    );
  });
});
