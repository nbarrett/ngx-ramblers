import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { WalkFilters } from "../../tasks/ramblers/walks/select-walks";
import { RamblersWalkSummaries } from "./ramblers-walks-summaries";

export class CountOfWalks extends Question<Promise<number>> {

  static selected = () => new CountOfWalks(`count of selected walks`);

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<number> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.filter(walk => WalkFilters.currentlySelected(walk)))
      .then(walks => walks.length);
  }

}
