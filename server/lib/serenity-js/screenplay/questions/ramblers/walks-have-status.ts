import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { every } from "lodash";
import { WalkFilters } from "../../tasks/ramblers/walks/select-walks";
import { RamblersWalkSummaries } from "./ramblers-walks-summaries";

export class WalksWithStatus {

  static matching = (...status: string[]) => new WalksWithStatusMatching(status);
  static notMatching = (...status: string[]) => new WalksWithStatusNotMatching(status);
}

export class WalksWithStatusMatching extends Question<Promise<boolean>> {
  constructor(private status: string[]) {
    super(`all walks to all have status of "${status}"`);
  }


  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => every(walks, walk => WalkFilters.withStatus(walk, ...this.status)));
  }

}

export class WalksWithStatusNotMatching extends Question<Promise<boolean>> {
  constructor(private status: string[]) {
    super(`no walks to have status of "${status}"`);
  }

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => every(walks, walk => !WalkFilters.withStatus(walk, ...this.status)));
  }

}
