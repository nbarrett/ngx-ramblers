import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { ElementFinder } from "protractor";

export class CheckedValue implements Question<Promise<boolean>> {
  static of = (target: Question<ElementFinder> | ElementFinder) => new CheckedValue(target);

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return promiseOf(this.target.answeredBy(actor).isSelected());
  }

  constructor(private target: Question<ElementFinder> | ElementFinder) {
  }

  toString = () => `the checked value of ${this.target}`;
}
