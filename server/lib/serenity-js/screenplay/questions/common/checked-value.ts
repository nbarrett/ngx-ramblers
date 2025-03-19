import { AnswersQuestions, Question, type QuestionAdapter, UsesAbilities } from "@serenity-js/core";
import { PageElement } from "@serenity-js/web";

export class CheckedValue extends Question<Promise<boolean>> {
  static of(target: QuestionAdapter<PageElement>): CheckedValue {
    return new CheckedValue(target);
  }

  constructor(private readonly target: QuestionAdapter<PageElement>) {
    super(`the checked value of ${target}`);
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    const element = await actor.answer(this.target);
    return element.isSelected();
  }

  toString(): string {
    return `the checked value of ${this.target}`;
  }
}
