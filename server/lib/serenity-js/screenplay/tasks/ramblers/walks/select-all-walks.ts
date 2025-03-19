import { PerformsActivities, Task } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { SelectCheckbox } from "../../common/select-checkbox";

export class SelectAllWalks extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      SelectCheckbox.checked().from(WalksPageElements.selectAll));
  }

}
