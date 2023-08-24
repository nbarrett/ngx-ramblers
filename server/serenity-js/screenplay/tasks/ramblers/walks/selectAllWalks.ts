import { PerformsActivities, Task } from "@serenity-js/core";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { SelectCheckbox } from "../../common/selectCheckbox";

export class SelectAllWalks implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      SelectCheckbox.checked().from(WalksTargets.selectAll));
  }

  toString() {
    return "#actor selects all walks";
  }

}
