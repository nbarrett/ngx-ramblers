import { PerformsActivities, Task } from "@serenity-js/core";
import { OsMapsExportClickOutcome } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { ArmOsMapsGpxDownloadListener } from "./arm-os-maps-gpx-download-listener";
import { ClickOsMapsExportButton } from "./click-os-maps-export-button";
import { ConfirmOsMapsExport } from "./confirm-os-maps-export";
import { DismissOsMapsOverlays } from "./dismiss-os-maps-overlays";
import { clearOsMapsExportOutcome, osMapsExportOutcome } from "./os-maps-export-outcome-store";
import { WaitForOsMapsExportOutcome } from "./wait-for-os-maps-export-outcome";

const EXPORT_CLICK_ATTEMPTS = 3;
const OUTCOMES_WORTH_ANOTHER_CLICK = [OsMapsExportClickOutcome.INTERRUPTED, OsMapsExportClickOutcome.NO_DIALOG_APPEARED];

export class StartOsMapsGpxDownload extends Task {

  static now() {
    return new StartOsMapsGpxDownload();
  }

  constructor() {
    super("#actor clicks Export GPX");
  }

  async performAs(actor: PerformsActivities): Promise<void> {
    await actor.attemptsTo(ArmOsMapsGpxDownloadListener.now());
    await this.clickUntilDownloadStarts(actor, 1, EXPORT_CLICK_ATTEMPTS);
  }

  private async clickUntilDownloadStarts(actor: PerformsActivities, attemptNumber: number, attemptsRemaining: number): Promise<void> {
    await actor.attemptsTo(
      ClickOsMapsExportButton.attempt(attemptNumber),
      WaitForOsMapsExportOutcome.attempt(attemptNumber)
    );
    const outcome = osMapsExportOutcome();
    clearOsMapsExportOutcome();
    if (outcome === OsMapsExportClickOutcome.CONFIRMATION_SHOWN) {
      await actor.attemptsTo(ConfirmOsMapsExport.now());
    } else if (OUTCOMES_WORTH_ANOTHER_CLICK.includes(outcome) && attemptsRemaining > 1) {
      await actor.attemptsTo(DismissOsMapsOverlays.now());
      await this.clickUntilDownloadStarts(actor, attemptNumber + 1, attemptsRemaining - 1);
    }
  }

}
