import { actorCalled, engage } from "@serenity-js/core";
import { Navigate } from "@serenity-js/web";
import moment from "moment-timezone";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/deleteWalks";
import { Publish } from "../screenplay/tasks/ramblers/walks/publish";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/uploadWalks";
import { Actors } from "./config/actors";
import { beforeEach, describe, it } from "mocha";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("serenity-walks-upload"));
debugLog.enabled = true;
const actor = process.env["RAMBLERS_USER"] || "Walks Admin";
debugLog("About to run Walks Upload scenario for", actor);
describe("Walks Upload", () => {
  beforeEach(() => {
    debugLog("Engaging actors");
    engage(new Actors());
  });

  it("walk upload", () => {
    const today = moment().tz("Europe/London").startOf("day").format("YYYY-MM-DD");
    return actorCalled(actor).attemptsTo(
      Start.onWalksAndEventsManager(),
      Login.toRamblers(),
      Navigate.to(`https://walks-manager.ramblers.org.uk/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${today}&d[max]=&rauid=all`),
      DeleteWalks.unpublishedOrWithIdsSupplied(),
      UploadWalks.requested(),
      Publish.walksInDraftState());
  });
});
