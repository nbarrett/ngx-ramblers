import { PerformsActivities, Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { SelectCheckbox } from "../../common/selectCheckbox";

export class SelectAllWalks extends Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      SelectCheckbox.checked().from(WalksTargets.selectAll));
  }

}
