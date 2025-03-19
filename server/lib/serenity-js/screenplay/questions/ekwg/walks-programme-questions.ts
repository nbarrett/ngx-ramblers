import { Question } from "@serenity-js/core";
import { WalksProgrammeTargets } from "../../ui/ekwg/walks-programme-targets";
import { Selected, Text } from "@serenity-js/web";

export class WalksProgrammeQuestions {
  public static FilterCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksFilterCriteria);
  public static SortAscendingCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksSortAscendingCriteria);
}
