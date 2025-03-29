import { actorCalled, engage } from "@serenity-js/core";
import { UseAngular } from "@serenity-js/protractor";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { RequestParameterExtractor } from "../screenplay/tasks/ramblers/common/requestParameterExtractor";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/deleteWalks";
import { FilterWalks } from "../screenplay/tasks/ramblers/walks/filterWalks";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/uploadWalks";
import { Actors } from "./config/actors";
import { THREE_MINUTES_MILLIS } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

describe("Walks and Events Manager", function () {

  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = THREE_MINUTES_MILLIS;
    engage(new Actors());
  });

  it("process command parameters", () => {
    const actor = actorCalled("nick");
    return actor.attemptsTo(
      RequestParameterExtractor.extractTask(),
      UseAngular.disableSynchronisation(),
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      FilterWalks.toShowAll(),
      DeleteWalks.unpublishedOrWithIdsSupplied(),
      UploadWalks.requested(),
    );
  });

});
