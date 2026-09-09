import { Answerable, AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { PageElement } from "@serenity-js/web";

export class ElementIsVisible extends Question<Promise<boolean>> {

  static of(target: Answerable<PageElement>): ElementIsVisible {
    return new ElementIsVisible(target);
  }

  constructor(private readonly target: Answerable<PageElement>) {
    super(`${target} is visible right now`);
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    const element = await actor.answer(this.target);
    return element.isVisible();
  }

}
