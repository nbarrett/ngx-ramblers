import { contain, Ensure, equals } from "@serenity-js/assertions";
import { actorCalled } from "@serenity-js/core";
import { WalkSummaries } from "../screenplay/questions/ekwg/walksFound";
import { WalksProgrammeQuestions } from "../screenplay/questions/ekwg/walksProgrammeQuestions";
import { Start } from "../screenplay/tasks/common/start";
import { FilterWalks } from "../screenplay/tasks/ekwg/filterWalks";

describe("Navigating to Walks Page", () => {

  const actor = actorCalled("nonLoggedIn");

  describe("Walks Page", () => {
    describe("Walks filter select", () => {
      it("displays walks from today onwards by default", () => actor.attemptsTo(
        Start.onWalksProgramme(),
        Ensure.that(WalksProgrammeQuestions.FilterCriteria, equals("Walks Today Onwards")),
      ));
      it("displays walks in ascending order by default", () => actor.attemptsTo(
        Start.onWalksProgramme(),
        Ensure.that(WalksProgrammeQuestions.SortAscendingCriteria, equals("Sort (date ascending)")),
        // Ensure.that(WalkSummaries.displayed(), contain("Sun 11-Jun-2017",
        //   "Sun 18-Jun-2017",
        //   "Sun 25-Jun-2017",
        //   "Sun 02-Jul-2017",
        //   "Sun 09-Jul-2017",
        //   "Sun 16-Jul-2017",
        //   "Sun 23-Jul-2017",
        //   "Sun 30-Jul-2017",
        //   "Sun 06-Aug-2017",
        //   "Sun 13-Aug-2017",
        //   "Sun 20-Aug-2017",
        //   "Sun 27-Aug-2017",
        //   "Sun 03-Sep-2017",
        //   "Sun 10-Sep-2017",
        //   "Sun 17-Sep-2017",
        //   "Sun 24-Sep-2017",
        //   "Sun 01-Oct-2017",
        // )),
      ));
      it("displays all walks");
      it("displays walks with no leader");
      it("displays walks with no details");
    });

    describe("Walks filter quick search", () => {
      it("allows filtering by matching word", () => actor.attemptsTo(
        Start.onWalksProgramme(),
        FilterWalks.toShowOnly("nick"),
      ));
    });
  });

});
