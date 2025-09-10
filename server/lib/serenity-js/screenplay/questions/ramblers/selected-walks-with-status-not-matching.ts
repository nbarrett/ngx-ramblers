import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { every } from "es-toolkit/compat";
import { WalkFilters } from "../../tasks/ramblers/walks/select-walks";
import { RamblersWalkSummaries } from "./ramblers-walks-summaries";

export class SelectedWalksWithStatusNotMatching extends Question<Promise<boolean>> {

  constructor(private status: string[]) {
    super(`no selected walks to have status of "${status}"`);
  }

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.filter(walk => WalkFilters.currentlySelected(walk)))
      .then(walks => every(walks, walk => !WalkFilters.withStatus(walk, ...this.status)));
  }

}
