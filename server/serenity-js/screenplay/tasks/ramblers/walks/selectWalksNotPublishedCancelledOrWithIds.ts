import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummary } from "../../../../models/ramblersWalkSummary";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblersWalksSummaries";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { Log } from "../../common/log";
import { SelectCheckbox } from "../../common/selectCheckbox";
import { SelectWalks, WalkFilters } from "./selectWalks";

export class SelectWalksNotPublishedCancelledOrWithIds implements Task {

  constructor(private walkIds: string[]) {
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then((walks: RamblersWalkSummary[]) => actor.attemptsTo(
        SelectWalks.none(),
        ...walks
          .map((walk, index) =>
            walk.cancelled || !WalkFilters.withStatus(walk, "Published") || WalkFilters.withIds(walk, ...this.walkIds) ?
              SelectCheckbox.checked().from(WalksTargets.checkboxSelector(index, walk.walkDate)) :
              Log.message(`Not selecting walk for ${walk.walkDate}`))));
  }

  toString() {
    return `#actor selects walks not published or with ids: ${this.walkIds}`;
  }

}
