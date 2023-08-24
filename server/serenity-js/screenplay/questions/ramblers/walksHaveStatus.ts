import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { every } from "lodash";
import { WalkFilters } from "../../tasks/ramblers/walks/selectWalks";
import { RamblersWalkSummaries } from "./ramblersWalksSummaries";

export class WalksWithStatus {

  static matching = (...status: string[]) => new WalksWithStatusMatching(status);
  static notMatching = (...status: string[]) => new WalksWithStatusNotMatching(status);
}

export class WalksWithStatusMatching implements Question<Promise<boolean>> {

  constructor(private status: string[]) {
  }

  toString = () => `all walks to all have status of "${this.status}"`;

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => every(walks, walk => WalkFilters.withStatus(walk, ...this.status)));
  }

}

export class WalksWithStatusNotMatching implements Question<Promise<boolean>> {

  constructor(private status: string[]) {
  }

  toString = () => `no walks to have status of "${this.status}"`;

  answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(walks => every(walks, walk => !WalkFilters.withStatus(walk, ...this.status)));
  }

}
