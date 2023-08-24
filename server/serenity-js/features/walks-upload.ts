import { actorCalled, engage } from "@serenity-js/core";
import { Navigate, UseAngular } from "@serenity-js/protractor";
import moment from "moment-timezone";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/deleteWalks";
import { Publish } from "../screenplay/tasks/ramblers/walks/publish";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/uploadWalks";
import { Actors } from "./config/actors";

describe("Walks and Events Manager", () => {

  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
    engage(new Actors());
  });


  it("walk upload", () => {
    const today = moment().tz("Europe/London").startOf("day").format("YYYY-MM-DD");
    return actorCalled(process.env["RAMBLERS_USER"] || "Walks Admin").attemptsTo(
      UseAngular.disableSynchronisation(),
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      Navigate.to(`https://walks-manager.ramblers.org.uk/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${today}&d[max]=&rauid=all`),
      DeleteWalks.unpublishedOrWithIdsSupplied(),
      UploadWalks.requested(),
      Publish.walksInDraftState());
  });
});
