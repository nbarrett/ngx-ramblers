import { describe, it } from "@serenity-js/playwright-test";
import { Ensure, equals } from "@serenity-js/assertions";
import { WalksProgrammeQuestions } from "../screenplay/questions/ekwg/walks-programme-questions";
import { Start } from "../screenplay/tasks/common/start";
import { FilterWalks } from "../screenplay/tasks/ekwg/filter-walks";

describe("Navigating to Walks Page", () => {
  describe("Walks Page", () => {
    describe("Walks filter select", () => {
      it("displays walks from today onwards by default", async ({ actorCalled }) => {
        await actorCalled("nonLoggedIn").attemptsTo(
          Start.onWalksProgramme(),
          Ensure.that(WalksProgrammeQuestions.FilterCriteria, equals("Walks Today Onwards")),
        );
      });
      it("displays walks in ascending order by default", async ({ actorCalled }) => {
        await actorCalled("nonLoggedIn").attemptsTo(
          Start.onWalksProgramme(),
          Ensure.that(WalksProgrammeQuestions.SortAscendingCriteria, equals("Sort (date ascending)")),
        );
      });
      it.skip("displays all walks", async () => {});
      it.skip("displays walks with no leader", async () => {});
      it.skip("displays walks with no details", async () => {});
    });

    describe("Walks filter quick search", () => {
      it("allows filtering by matching word", async ({ actorCalled }) => {
        await actorCalled("nonLoggedIn").attemptsTo(
          Start.onWalksProgramme(),
          FilterWalks.toShowOnly("nick"),
        );
      });
    });
  });

});
