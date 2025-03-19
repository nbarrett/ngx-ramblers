import { Check, Log, PerformsActivities, Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { Delete } from "./deleteSelectedWalks";
import { SelectWalks } from "./selectWalks";
import { Unpublish } from "./unpublish";
import { isVisible } from "@serenity-js/web";

export class DeleteAllWalks extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksTargets.selectAll, isVisible())
        .andIfSo(SelectWalks.all(),
          Unpublish.selectedWalks(),
          Delete.selectedWalks())
        .otherwise(Log.the("there are no walks to unpublish or delete")));
  }

  toString() {
    return "#actor deletes all walks";
  }

}
