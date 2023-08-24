import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { WalkFilters } from "../../tasks/ramblers/walks/selectWalks";
import { RamblersWalkSummaries } from "./ramblersWalksSummaries";

export class CountOfWalks implements Question<Promise<number>> {

  static selected = () => new CountOfWalks();

  toString = () => `count of selected walks`;

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<number> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.filter(walk => WalkFilters.currentlySelected(walk)))
      .then(walks => walks.length);
  }

}
