import { actorCalled, engage } from "@serenity-js/core";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { RequestParameterExtractor } from "../screenplay/tasks/ramblers/common/requestParameterExtractor";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/deleteWalks";
import { FilterWalks } from "../screenplay/tasks/ramblers/walks/filterWalks";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/uploadWalks";
import { Actors } from "./config/actors";
import { FIVE_MINUTES_MILLIS } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

describe("Walks and Events Manager", function () {

  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = FIVE_MINUTES_MILLIS;
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
