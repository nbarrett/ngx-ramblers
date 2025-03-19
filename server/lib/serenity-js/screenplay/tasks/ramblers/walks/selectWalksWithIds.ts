import { AnswersQuestions, Log, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblersWalksSummaries";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { SelectCheckbox } from "../../common/selectCheckbox";
import { SelectWalks, WalkFilters } from "./selectWalks";

export class SelectWalksWithIds extends Task {

  constructor(private walkIds: string[]) {
    super(`#actor selects walks with ids: ${walkIds}`);
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => actor.attemptsTo(
        SelectWalks.none(),
        ...walks
          .map((walk, index) => WalkFilters.withIds(walk, ...this.walkIds) ?
            SelectCheckbox.checked().from(WalksTargets.checkboxSelector(walk.tableRow, walk.walkDate))
            : Log.the(`Not Selecting walk ${walk.walkDate}`))));
  }
}
