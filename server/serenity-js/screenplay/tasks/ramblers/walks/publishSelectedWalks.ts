import { PerformsActivities, Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { WaitFor } from "../common/waitFor";

export class PublishSelectedWalks implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      ClickWhenReady.on(WalksTargets.publishSelected),
      WaitFor.successAlertToContainMessage("been published"));
  }

  toString() {
    return "#actor publishes selected walks";
  }
}
