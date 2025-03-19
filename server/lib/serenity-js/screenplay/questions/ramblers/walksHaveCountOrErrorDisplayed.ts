import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { ErrorAlert } from "./errorAlert";
import { WalksHaveCount } from "./walksHaveCount";

export class WalksHaveCountOrErrorDisplayed extends Question<Promise<boolean>> {

  static matching = (count: number) => new WalksHaveCountOrErrorDisplayed(count);

  constructor(private count: number) {
    super(`error or walk listing count to be ${count}`);
  }

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return ErrorAlert.displayed().answeredBy(actor).then(displayed => {
      return displayed || WalksHaveCount.matching(this.count).answeredBy(actor);
    });
  }
}
