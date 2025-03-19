import { Check, PerformsActivities, Task } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WaitFor } from "../common/wait-for";
import { isPresent } from "@serenity-js/assertions";
import { Log } from "../common/log";

export class FilterWalks {

  static toShowAll() {
    return new FilterWalksToShowAll("#actor filters walks to show all");
  }

}

export class FilterWalksToShowAll extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksPageElements.selectAll, isPresent())
        .andIfSo(
          ClickWhenReady.on(WalksPageElements.itemsPerPagePopup),
          ClickWhenReady.on(WalksPageElements.showAllWalks),
          WaitFor.ramblersToFinishProcessing())
        .otherwise(Log.message("No filtering required as no walks shown")));
  }

}
