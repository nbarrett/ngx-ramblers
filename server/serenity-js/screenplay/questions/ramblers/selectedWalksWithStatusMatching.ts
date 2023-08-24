import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { every } from "lodash";
import { WalkFilters } from "../../tasks/ramblers/walks/selectWalks";
import { RamblersWalkSummaries } from "./ramblersWalksSummaries";

export class SelectedWalksWithStatusMatching implements Question<Promise<boolean>> {

  constructor(private status: string[]) {
  }

  toString = () => `selected walks to all have status of "${this.status}"`;

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => walks.filter(walk => WalkFilters.currentlySelected(walk)))
      .then(walks => every(walks, walk => WalkFilters.withStatus(walk, ...this.status)));
  }

}
