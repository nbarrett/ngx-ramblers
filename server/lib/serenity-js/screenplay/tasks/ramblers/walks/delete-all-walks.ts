import { Check, PerformsActivities, Task } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { Delete } from "./delete-selected-walks";
import { SelectWalks } from "./select-walks";
import { Unpublish } from "./unpublish";
import { isVisible } from "@serenity-js/web";
import { Log } from "../common/log";

export class DeleteAllWalks extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksPageElements.selectAll, isVisible())
        .andIfSo(SelectWalks.all(),
          Unpublish.selectedWalks(),
          Delete.selectedWalks())
        .otherwise(Log.message("there are no walks to unpublish or delete")));
  }

  toString() {
    return "#actor deletes all walks";
  }

}
