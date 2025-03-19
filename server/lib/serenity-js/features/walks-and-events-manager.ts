import { actorCalled } from "@serenity-js/core";
import { Start } from "../screenplay/tasks/common/start";
import { Login } from "../screenplay/tasks/ramblers/common/login";
import { DeleteWalks } from "../screenplay/tasks/ramblers/walks/delete-walks";
import { FilterWalks } from "../screenplay/tasks/ramblers/walks/filter-walks";
import { Publish } from "../screenplay/tasks/ramblers/walks/publish";
import { SelectWalks } from "../screenplay/tasks/ramblers/walks/select-walks";
import { UploadWalks } from "../screenplay/tasks/ramblers/walks/upload-walks";

describe("Walks and Events Manager", function () {
  this.timeout(150 * 1000);
  const actor = actorCalled("nick");
  const fileName = "/Users/nick/dev/git-personal/ekwg/non-vcs/walk-exports/walks-export-07-February-2018-08-39.csv";
  const expectedWalks = 4;
  it("allows a file to be uploaded and published that replaces all existing walks", () => actor.attemptsTo(
    Start.onWalksAndEventsManager(),
    Login.toRamblers(),
    FilterWalks.toShowAll(),
    DeleteWalks.all(),
    UploadWalks.fileWithNameAndCount(fileName, expectedWalks),
    Publish.walksInDraftState(),
  ));

  it("allows a file to be uploaded, replacing supplied walk ids", () => actor.attemptsTo(
    Start.onWalksAndEventsManager(),
    Login.toRamblers(),
    FilterWalks.toShowAll(),
    DeleteWalks.withIds("3953611", "3953609"),
    UploadWalks.fileWithNameAndCount(fileName, expectedWalks),
    Publish.walksInDraftState(),
  ));

  it("test question", () => actor.attemptsTo(
    Start.onWalksAndEventsManager(),
    Login.toRamblers(),
    SelectWalks.withStatus("Published"),
    SelectWalks.withIds("3955387"),
    DeleteWalks.withIds("3955389"),
  ));

});
