import { Question } from "@serenity-js/core";
import { WalksProgrammeTargets } from "../../ui/ekwg/walksProgrammeTargets";
import { Selected, Text } from "@serenity-js/web";

export class WalksProgrammeQuestions {
  public static QuickSearch: Question<Promise<string>> = Text.of(WalksProgrammeTargets.quickSearch);
  public static FilterCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksFilterCriteria);
  public static SortAscendingCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksSortAscendingCriteria);
}
