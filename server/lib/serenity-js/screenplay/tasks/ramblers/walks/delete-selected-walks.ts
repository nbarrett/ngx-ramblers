import { isGreaterThan } from "@serenity-js/assertions";
import { AnswersQuestions, Check, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { CountOfWalks } from "../../../questions/ramblers/count-of-walks";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WaitFor } from "../common/wait-for";

export class Delete extends Task {

  static selectedWalks(): Task {
    return new Delete("Delete Selected Walks");
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    return actor.attemptsTo(
      Check.whether(CountOfWalks.selected(), isGreaterThan(0))
        .andIfSo(ClickWhenReady.on(WalksPageElements.deleteSelected),
          ClickWhenReady.on(WalksPageElements.executeActionButton),
          WaitFor.successAlertToEventuallyContain("been deleted")));
  }
}
