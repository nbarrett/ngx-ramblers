import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummary } from "../../../../models/ramblers-walk-summary";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblers-walks-summaries";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { SelectCheckbox } from "../../common/select-checkbox";
import { SelectWalks, WalkFilters } from "./select-walks";

export class SelectWalksNotPublishedCancelledOrWithIds extends Task {

  constructor(private walkIds: string[]) {
    super(`#actor selects walks not published${walkIds?.length > 0 ? " or with ids " + walkIds.join(",") : ""}`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    const walks: RamblersWalkSummary[] = await actor.answer(RamblersWalkSummaries.displayed());
    return actor.attemptsTo(
        SelectWalks.none(),
      ...walks.filter((walk, index) =>
        walk.cancelled || !WalkFilters.withStatus(walk, "Published") || WalkFilters.withIds(walk, ...this.walkIds))
        .map(walk => SelectCheckbox.checked().from(WalksPageElements.checkboxSelector(walk.tableRow, walk.walkDate))));
  }

}
