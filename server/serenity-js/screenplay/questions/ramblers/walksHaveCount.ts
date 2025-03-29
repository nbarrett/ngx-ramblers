import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { RamblersWalkSummaries } from "./ramblersWalksSummaries";

export class WalksHaveCount implements Question<Promise<boolean>> {

  static matching = (count: number) => new WalksHaveCount(count);

  constructor(private count: number) {
  }

  toString = () => `walk listing count to be ${this.count}`;

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.length === this.count);
  }

}
