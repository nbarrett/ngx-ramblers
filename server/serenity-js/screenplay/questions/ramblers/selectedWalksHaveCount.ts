import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { WalkFilters } from "../../tasks/ramblers/walks/selectWalks";
import { RamblersWalkSummaries } from "./ramblersWalksSummaries";

export class SelectedWalksHaveCount implements Question<Promise<boolean>> {

  static matching = (walkCount: number) => new SelectedWalksHaveCount(walkCount);

  constructor(private walkCount: number) {
  }

  toString = () => `selected walk count to be ${this.walkCount}`;

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.filter(walk => WalkFilters.currentlySelected(walk)))
      .then(walks => {
        return walks.length === this.walkCount;
      });
  }

}
