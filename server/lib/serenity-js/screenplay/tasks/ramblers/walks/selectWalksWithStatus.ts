import { AnswersQuestions, Log, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblersWalksSummaries";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { SelectCheckbox } from "../../common/selectCheckbox";
import { SelectWalks, WalkFilters } from "./selectWalks";

export class SelectWalksWithStatus extends Task {

  constructor(private statuses: string[]) {
    super(`#actor selects walks with status ${statuses}`);
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    console.log(`selecting walks with status "${this.statuses}"`);
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => actor.attemptsTo(
        SelectWalks.none(),
        ...walks
          .map((walk, index) => WalkFilters.withStatus(walk, ...this.statuses) ?
            SelectCheckbox.checked().from(WalksTargets.checkboxSelector(walk.tableRow, walk.walkDate))
            : Log.the(`Not Selecting ${walk.status} walk`))));
  }

}
