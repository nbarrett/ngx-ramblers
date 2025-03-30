import { PublishWalksInDraftState } from "./publishWalksInDraftState";
import { Task } from "@serenity-js/core/lib/screenplay";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { WaitFor } from "../common/waitFor";

export class Publish {

  static selectedWalks() {
    return Task.where(`"#actor publishes selected walks`,
      ClickWhenReady.on(WalksTargets.publishSelected),
      WaitFor.ramblersToFinishProcessing(),
      WaitFor.successAlertToContainMessage("been published"));
  }

  static walksInDraftState() {
    return new PublishWalksInDraftState();
  }

}

