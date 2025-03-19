import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { WalkFilters } from "../../tasks/ramblers/walks/select-walks";
import { RamblersWalkSummaries } from "./ramblers-walks-summaries";

export class SelectedWalksHaveCount extends Question<Promise<boolean>> {

  static matching = (walkCount: number) => new SelectedWalksHaveCount(walkCount);

  constructor(private walkCount: number) {
    super(`selected walk count to be ${walkCount}`);
  }

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.filter(walk => WalkFilters.currentlySelected(walk)))
      .then(walks => walks.length === this.walkCount);
  }

}
