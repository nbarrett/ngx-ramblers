import { Question } from "@serenity-js/core";
import { Selected } from "@serenity-js/protractor";
import { Text } from "@serenity-js/protractor/lib/screenplay/questions/text";
import { WalksProgrammeTargets } from "../../ui/ekwg/walksProgrammeTargets";

export class WalksProgrammeQuestions {
  public static QuickSearch: Question<Promise<string>> = Text.of(WalksProgrammeTargets.quickSearch);
  public static FilterCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksFilterCriteria);
  public static SortAscendingCriteria: Question<Promise<string>> = Selected.optionIn(WalksProgrammeTargets.walksSortAscendingCriteria);
}
