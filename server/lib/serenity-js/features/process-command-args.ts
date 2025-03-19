import { actorCalled, engage } from "@serenity-js/core";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { RequestParameterExtractor } from "../screenplay/tasks/ramblers/common/request-parameter-extractor";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/delete-walks";
import { FilterWalks } from "../screenplay/tasks/ramblers/walks/filter-walks";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/upload-walks";
import { Actors } from "./config/actors";
import "mocha";

describe("Walks and Events Manager", function () {

  beforeEach(() => {
    engage(new Actors());
  });

  it("process command parameters", () => {
    const actor = actorCalled("nick");
    return actor.attemptsTo(
      RequestParameterExtractor.extractTask(),
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      FilterWalks.toShowAll(),
      DeleteWalks.unpublishedOrWithIdsSupplied(),
      UploadWalks.requested(),
    );
  });

});
