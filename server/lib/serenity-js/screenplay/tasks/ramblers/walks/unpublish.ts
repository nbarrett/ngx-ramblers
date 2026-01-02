import { AnswersQuestions, Check, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { isGreaterThan } from "@serenity-js/assertions";
import { CountOfWalks } from "../../../questions/ramblers/count-of-walks";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WaitFor } from "../common/wait-for";

export class Unpublish extends Task {

  static selectedWalks(): Task {
    return new Unpublish("Unpublish Selected Walks");
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    return actor.attemptsTo(
      Check.whether(CountOfWalks.selected(), isGreaterThan(0))
        .andIfSo(
          ClickWhenReady.on(WalksPageElements.unPublishSelected),
          WaitFor.successAlertToEventuallyContain("been unpublished")
        )
    );
  }
}
