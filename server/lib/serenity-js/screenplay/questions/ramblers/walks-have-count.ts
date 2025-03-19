import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { RamblersWalkSummaries } from "./ramblers-walks-summaries";

export class WalksHaveCount extends Question<Promise<boolean>> {

  static matching = (count: number) => new WalksHaveCount(count);

  constructor(private count: number) {
    super(`walk listing count to be ${count}`);
  }

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => {
        return walks.length === this.count;
      });
  }

}
