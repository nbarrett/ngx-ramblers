import { describe, it } from "@serenity-js/playwright-test";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { RequestParameterExtractor } from "../screenplay/tasks/ramblers/common/request-parameter-extractor";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/delete-walks";
import { FilterWalks } from "../screenplay/tasks/ramblers/walks/filter-walks";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/upload-walks";

describe("Walks and Events Manager", function () {
  it("process command parameters", async ({ actorCalled }) => {
    const actor = actorCalled("nick");
    await actor.attemptsTo(
      RequestParameterExtractor.extractTask(),
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      FilterWalks.toShowAll(),
      DeleteWalks.unpublishedOrWithIdsSupplied(),
      UploadWalks.requested(),
    );
  });
});
