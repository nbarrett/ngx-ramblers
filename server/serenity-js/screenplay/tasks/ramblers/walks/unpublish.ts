import { Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { ClickWhenReady } from "../../common/clickWhenReady";
import { WaitFor } from "../common/waitFor";

export class Unpublish {

  static selectedWalks(): Task {
    return Task.where("#actor unpublishes selected walks",
      ClickWhenReady.on(WalksTargets.unPublishSelected),
      WaitFor.successAlertToContainMessage("been unpublished"));
  }
}
