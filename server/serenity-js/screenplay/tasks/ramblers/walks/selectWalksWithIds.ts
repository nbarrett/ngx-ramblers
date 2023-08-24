import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblersWalksSummaries";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { Log } from "../../common/log";
import { SelectCheckbox } from "../../common/selectCheckbox";
import { WaitFor } from "../common/waitFor";
import { SelectWalks, WalkFilters } from "./selectWalks";

export class SelectWalksWithIds implements Task {

  constructor(private walkIds: string[]) {
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => actor.attemptsTo(
        SelectWalks.none(),
        ...walks
          .map((walk, index) => WalkFilters.withIds(walk, ...this.walkIds) ?
            SelectCheckbox.checked().from(WalksTargets.checkboxSelector(index, walk.walkDate))
            : Log.message(`Not Selecting walk ${walk.walkDate}`))));
  }

  toString() {
    return `#actor selects walks with ids: ${this.walkIds}`;
  }

}
