import { Check } from "@serenity-js/assertions";
import { PerformsActivities, Task } from "@serenity-js/core";
import { isPresent } from "@serenity-js/protractor";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { Log } from "../../common/log";
import { WaitFor } from "../common/waitFor";

export class FilterWalks {

  static toShowAll() {
    return new FilterWalksToShowAll();
  }

}

export class FilterWalksToShowAll implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksTargets.selectAll, isPresent())
        .andIfSo(
          ClickWhenReady.on(WalksTargets.itemsPerPagePopup),
          ClickWhenReady.on(WalksTargets.showAllWalks),
          WaitFor.ramblersToFinishProcessing())
        .otherwise(Log.message("No filtering required as no walks shown")));
  }

  toString() {
    return "#actor filters walks to show all";
  }
}
