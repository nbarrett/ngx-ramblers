import { Check, PerformsActivities, Task } from "@serenity-js/core";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { Log } from "../common/log";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { WaitFor } from "../common/wait-for";
import { SelectWalks } from "./select-walks";
import { isGreaterThan } from "@serenity-js/assertions";
import { CountOfWalks } from "../../../questions/ramblers/count-of-walks";
import { ClickWhenReady } from "../../common/click-when-ready";

export class UncancelWalks {
  static withIdsSupplied(): Task {
    return new UncancelWalksWithIds(RequestParameterExtractor.extract().walkUncancellations || []);
  }
}

export class UncancelWalksWithIds extends Task {

  constructor(private walkIds: string[]) {
    super(`#actor uncancels ${walkIds.length} walk(s)`);
  }

  async performAs(actor: PerformsActivities): Promise<void> {
    if (this.walkIds.length === 0) {
      return actor.attemptsTo(Log.message("No walks to uncancel"));
    }

    return actor.attemptsTo(
      Log.message(`Uncancelling ${this.walkIds.length} walk(s)`),
      SelectWalks.withIds(...this.walkIds),
      Check.whether(CountOfWalks.selected(), isGreaterThan(0))
        .andIfSo(
          ClickWhenReady.on(WalksPageElements.uncancelSelected),
          WaitFor.successAlertToEventuallyContain("been uncancelled")
        )
    );
  }
}
