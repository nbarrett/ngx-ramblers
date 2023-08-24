import { Check } from "@serenity-js/assertions";
import { PerformsActivities, Task } from "@serenity-js/core";
import { isVisible } from "@serenity-js/protractor";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { Log } from "../../common/log";
import { RequestParameterExtractor } from "../common/requestParameterExtractor";
import { DeleteAllWalks } from "./deleteAllWalks";
import { Delete } from "./deleteSelectedWalks";
import { SelectWalks } from "./selectWalks";

export class DeleteWalks {

  static all(): Task {
    return new DeleteAllWalks();
  }

  static unpublishedOrWithIdsSupplied(): Task {
    return new DeleteUnpublishedOrWalksWithIds(RequestParameterExtractor.extract().walkDeletions);
  }

  static withIds(...walkIds: string[]) {
    return new DeleteUnpublishedOrWalksWithIds(walkIds);
  }

}

export class DeleteUnpublishedOrWalksWithIds implements Task {

  private suffix: string;

  constructor(private walkIds: string[]) {
    this.suffix = walkIds.length > 0 ? `and those with ids ${this.walkIds}` : ``;
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Check.whether(WalksTargets.walkListviewTable, isVisible())
        .andIfSo(SelectWalks.notPublishedOrWithIds(this.walkIds),
          Delete.selectedWalks())
        .otherwise(Log.message(`it's not possible to delete walks ${this.walkIds}`)));
  }

  toString() {
    return `#actor deletes unpublished walks ${this.suffix}`;
  }

}
