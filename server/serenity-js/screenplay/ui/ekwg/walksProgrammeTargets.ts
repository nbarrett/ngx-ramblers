import { Target } from "@serenity-js/protractor";
import { by } from "protractor";

export class WalksProgrammeTargets {
  public static quickSearch = Target.the("Walks quick search")
    .located(by.model("filterParameters.quickSearch"));

  public static walksFilterCriteria = Target.the("Walks filter criteria")
    .located(by.model("filterParameters.selectType"));

  public static walksSortAscendingCriteria = Target.the("Walks Sort ascending criteria")
    .located(by.model("filterParameters.ascending"));

  public static walks = Target.the("walks programme")
    .located(by.repeater("walk in filteredWalks"));
}
