import { Check, Log, PerformsActivities, Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { RequestParameterExtractor } from "../common/requestParameterExtractor";
import { DeleteAllWalks } from "./deleteAllWalks";
import { Delete } from "./deleteSelectedWalks";
import { SelectWalks } from "./selectWalks";
import { isVisible } from "@serenity-js/web";

export class DeleteWalks {

  static all(): Task {
    return new DeleteAllWalks("Delete all walks");
  }

  static unpublishedOrWithIdsSupplied(): Task {
    return new DeleteUnpublishedOrWalksWithIds(RequestParameterExtractor.extract().walkDeletions);
  }

  static withIds(...walkIds: string[]) {
    return new DeleteUnpublishedOrWalksWithIds(walkIds);
  }

}

export class DeleteUnpublishedOrWalksWithIds extends Task {

  constructor(private walkIds: string[]) {
    super(`#actor deletes unpublished walks ${walkIds.length > 0 ? `and those with ids ${walkIds}` : ``}`);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksTargets.walkListviewTable, isVisible())
        .andIfSo(SelectWalks.notPublishedOrWithIds(this.walkIds),
          Delete.selectedWalks())
        .otherwise(Log.the(`it's not possible to delete walks ${this.walkIds}`)));
  }


}
