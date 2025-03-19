import { Check, Task } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { isPresent } from "@serenity-js/assertions";
import { Log } from "../common/log";
import { SelectWalks } from "./select-walks";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WaitFor } from "../common/wait-for";

export class Publish {

  static selectedWalks(): Task {
    return Task.where("#actor publishes selected walks",
      ClickWhenReady.on(WalksPageElements.publishSelected),
      WaitFor.successAlertToEventuallyContain("been published"));
  }

  static walksInDraftState(): Task {
    return Task.where("#actor publishes Draft walks",
      Check.whether(WalksPageElements.errorAlert, isPresent())
        .andIfSo(Log.message("Can't publish as an alert is showing"))
        .otherwise(SelectWalks.withStatus("Draft"),
          Publish.selectedWalks()));
  }
}

