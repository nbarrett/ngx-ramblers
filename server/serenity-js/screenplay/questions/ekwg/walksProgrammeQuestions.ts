import { Question } from "@serenity-js/core";
import { Selected } from "@serenity-js/protractor";
import { WalksProgrammeTargets } from "../../ui/ekwg/walksProgrammeTargets";

export class WalksProgrammeQuestions {
  public static FilterCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksFilterCriteria);
  public static SortAscendingCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksSortAscendingCriteria);
}
