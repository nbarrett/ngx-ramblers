import { Check, Log, PerformsActivities, Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { WaitFor } from "../common/waitFor";
import { isPresent } from "@serenity-js/assertions";

export class FilterWalks {

  static toShowAll() {
    return new FilterWalksToShowAll("#actor filters walks to show all");
  }

}

export class FilterWalksToShowAll extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksTargets.selectAll, isPresent())
        .andIfSo(
          ClickWhenReady.on(WalksTargets.itemsPerPagePopup),
          ClickWhenReady.on(WalksTargets.showAllWalks),
          WaitFor.ramblersToFinishProcessing())
        .otherwise(Log.the("No filtering required as no walks shown")));
  }

}
