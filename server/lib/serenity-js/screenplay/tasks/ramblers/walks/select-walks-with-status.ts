import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblers-walks-summaries";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { SelectCheckbox } from "../../common/select-checkbox";
import { SelectWalks, WalkFilters } from "./select-walks";

export class SelectWalksWithStatus extends Task {

  constructor(private statuses: string[]) {
    super(`#actor selects walks with status ${statuses}`);
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => actor.attemptsTo(
        SelectWalks.none(),
        ...walks
          .filter((walk, index) => WalkFilters.withStatus(walk, ...this.statuses))
          .map(walk =>
            SelectCheckbox.checked().from(WalksPageElements.checkboxSelector(walk.tableRow, walk.walkDate)))));
  }

}
