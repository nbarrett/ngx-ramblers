import { Task } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WaitFor } from "../common/wait-for";

export class Unpublish {

  static selectedWalks(): Task {
    return Task.where("#actor unpublishes selected walks",
      ClickWhenReady.on(WalksPageElements.unPublishSelected),
      WaitFor.successAlertToEventuallyContain("been unpublished"));
  }
}
