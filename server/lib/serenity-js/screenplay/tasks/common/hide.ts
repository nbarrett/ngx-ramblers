import { AnswersQuestions, PerformsActivities, Question, Task, UsesAbilities } from "@serenity-js/core";
import { ExecuteScript, PageElement } from "@serenity-js/web";

export class Hide extends Task {

  static target(target: Question<PageElement>): Task {
    return new Hide(target);
  }

  constructor(private target: Question<PageElement>) {
    super(`hide the target ${target}`);
  }

  performAs(actor: AnswersQuestions & PerformsActivities & UsesAbilities): Promise<void> {
    return this.target.answeredBy(actor).isPresent()
      .then(present => {
        if (present) {
          return actor.attemptsTo(ExecuteScript.sync(`arguments[0].style.visibility='hidden'`).withArguments(this.target));
        }
      });
  }
}
