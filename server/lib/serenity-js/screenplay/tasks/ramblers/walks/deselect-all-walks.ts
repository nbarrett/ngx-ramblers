import { PerformsActivities, Task } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { SelectCheckbox } from "../../common/select-checkbox";

export class DeselectAllWalks extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      SelectCheckbox.unchecked().from(WalksPageElements.selectAll));
  }

}
