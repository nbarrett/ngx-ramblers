import { AnswersQuestions, PerformsActivities, Question, Task, UsesAbilities } from "@serenity-js/core";
import { ExecuteScript } from "@serenity-js/protractor";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { ElementFinder } from "protractor";

export class Hide implements Task {

  static target(target: Question<ElementFinder> | ElementFinder): Task {
    return new Hide(target);
  }

  constructor(private target: Question<ElementFinder> | ElementFinder) {
  }

  performAs(actor: AnswersQuestions & PerformsActivities & UsesAbilities): Promise<void> {
    return promiseOf(this.target.answeredBy(actor).isPresent()
      .then(present => present && actor.attemptsTo(ExecuteScript.sync(`arguments[0].style.visibility='hidden'`).withArguments(this.target))));
  }
}
