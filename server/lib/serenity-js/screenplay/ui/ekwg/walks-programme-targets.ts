import { By, PageElement, PageElements } from "@serenity-js/web";

export class WalksProgrammeTargets {
  public static quickSearch = PageElement.located(By.css("input[ng-model='filterParameters.quickSearch']"))
    .describedAs("Walks quick search");

  public static walksFilterCriteria = PageElement.located(By.css("select[ng-model='filterParameters.selectType'], input[ng-model='filterParameters.selectType']"))
    .describedAs("Walks filter criteria");

  public static walksSortAscendingCriteria = PageElement.located(By.css("input[ng-model='filterParameters.ascending'], select[ng-model='filterParameters.ascending']"))
    .describedAs("Walks Sort ascending criteria");

  public static walkss = PageElements.located(By.css("[ng-repeat='walk in filteredWalks']"))
    .describedAs("walks programme");
}
