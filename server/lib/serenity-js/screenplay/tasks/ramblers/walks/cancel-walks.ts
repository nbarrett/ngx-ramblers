import { Check, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { SelectWalks } from "./select-walks";
import { isGreaterThan, isPresent } from "@serenity-js/assertions";
import { Log } from "../common/log";
import { ClickWhenReady } from "../../common/click-when-ready";
import { Enter } from "@serenity-js/web";
import { CountOfWalks } from "../../../questions/ramblers/count-of-walks";
import { WaitFor } from "../common/wait-for";
import { WalkCancellation } from "../../../../../models/walk-upload-metadata";

export class CancelWalks {

  static withIdsSupplied(): Task {
    return new CancelWalksWithReasons(RequestParameterExtractor.extract().walkCancellations);
  }

}

export class CancelWalksWithReasons extends Task {

  constructor(private walkCancellations: WalkCancellation[]) {
    super(`#actor cancels ${walkCancellations.length} walk(s) with individual reasons`);
  }

  async performAs(actor: PerformsActivities): Promise<void> {
    if (this.walkCancellations.length === 0) {
      return actor.attemptsTo(
        Log.message("No walks to cancel")
      );
    }

    const groupedByReason = this.groupByReason(this.walkCancellations);

    for (const [reason, walkIds] of Object.entries(groupedByReason)) {
      await actor.attemptsTo(
        Log.message(`Cancelling ${walkIds.length} walk(s) with reason: "${reason}"`),
        Wait.until(WalksPageElements.walkListTable, isPresent()),
        SelectWalks.withIds(...walkIds),
        Check.whether(CountOfWalks.selected(), isGreaterThan(0))
          .andIfSo(
            ClickWhenReady.on(WalksPageElements.cancelSelected),
            Wait.until(WalksPageElements.cancelModal, isPresent()),
            Enter.theValue(reason).into(WalksPageElements.cancelReasonTextarea),
            ClickWhenReady.on(WalksPageElements.cancelSubmitButton),
            WaitFor.successAlertToEventuallyContain("been cancelled")
          )
      );
    }
  }

  private groupByReason(cancellations: WalkCancellation[]): { [reason: string]: string[] } {
    const grouped: { [reason: string]: string[] } = {};
    for (const cancellation of cancellations) {
      const reason = cancellation.reason || "Walk cancelled";
      if (!grouped[reason]) {
        grouped[reason] = [];
      }
      grouped[reason].push(cancellation.walkId);
    }
    return grouped;
  }

}
