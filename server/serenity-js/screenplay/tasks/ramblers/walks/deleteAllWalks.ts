import { Check } from "@serenity-js/assertions";
import { PerformsActivities, Task } from "@serenity-js/core";
import { isVisible } from "@serenity-js/protractor";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { Log } from "../../common/log";
import { Delete } from "./deleteSelectedWalks";
import { SelectWalks } from "./selectWalks";
import { Unpublish } from "./unpublish";

export class DeleteAllWalks implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksTargets.selectAll, isVisible())
        .andIfSo(SelectWalks.all(),
          Unpublish.selectedWalks(),
          Delete.selectedWalks())
        .otherwise(Log.message("there are no walks to unpublish or delete")));
  }

  toString() {
    return "#actor deletes all walks";
  }

}
