import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { PageElement } from "@serenity-js/web";

export class Visibility extends Question<Promise<boolean>> {
  constructor(private target: Question<PageElement>) {
    super(`the visibility of ${target}`);
  }

  static of = (target: Question<PageElement>) => new Visibility(target);

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return this.target.answeredBy(actor).isVisible();
  }

}
