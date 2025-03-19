import { Answerable, AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { PageElement } from "@serenity-js/web";

export class Visibility extends Question<Promise<boolean>> {
  constructor(private target: Answerable<PageElement>) {
    super(`the visibility of ${target}`);
  }

  static of = (target: Answerable<PageElement>) => new Visibility(target);

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return actor.answer(this.target).then(item => item.isClickable());
  }

}
