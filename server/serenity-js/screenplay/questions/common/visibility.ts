import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { ElementFinder } from "protractor";

export class Visibility implements Question<Promise<boolean>> {
  static of = (target: Question<ElementFinder> | ElementFinder) => new Visibility(target);

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return promiseOf(this.target.answeredBy(actor).isDisplayed());
  }

  constructor(private target: Question<ElementFinder> | ElementFinder) {
  }

  toString = () => `the visibility of ${this.target}`;
}
