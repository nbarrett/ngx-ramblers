import { isGreaterThan } from "@serenity-js/assertions";
import { AnswersQuestions, Check, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { CountOfWalks } from "../../../questions/ramblers/countOfWalks";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { WaitFor } from "../common/waitFor";

export class Delete extends Task {

  static selectedWalks(): Task {
    return new Delete("Delete Selected Walks");
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    return actor.attemptsTo(
      Check.whether(CountOfWalks.selected(), isGreaterThan(0))
        .andIfSo(ClickWhenReady.on(WalksTargets.deleteSelected),
          ClickWhenReady.on(WalksTargets.executeActionButton),
          WaitFor.successAlertToContainMessage("been deleted")));
  }
}
