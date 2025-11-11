import { PerformsActivities, Task, Wait } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { DeleteAllWalks } from "./delete-all-walks";
import { Delete } from "./delete-selected-walks";
import { SelectWalks } from "./select-walks";
import { isPresent } from "@serenity-js/assertions";

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
      Wait.until(WalksPageElements.walkListTable, isPresent()),
      SelectWalks.notPublishedOrWithIds(this.walkIds),
      Delete.selectedWalks()
    );
  }


}
