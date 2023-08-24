import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblersWalksSummaries";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { Log } from "../../common/log";
import { SelectCheckbox } from "../../common/selectCheckbox";
import { SelectWalks, WalkFilters } from "./selectWalks";

export class SelectWalksWithStatus implements Task {

  constructor(private statuses: string[]) {
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    console.log(`selecting walks with status "${this.statuses}"`);
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => actor.attemptsTo(
        SelectWalks.none(),
        ...walks
          .map((walk, index) => WalkFilters.withStatus(walk, ...this.statuses) ?
            SelectCheckbox.checked().from(WalksTargets.checkboxSelector(index, walk.walkDate))
            : Log.message(`Not Selecting ${walk.status} walk`))));
  }

  toString() {
    return `#actor selects walks with status ${this.statuses}`;
  }

}
