import { PerformsActivities, Task } from "@serenity-js/core";
import { Click } from "@serenity-js/protractor";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { SelectCheckbox } from "../../common/selectCheckbox";
import { WaitFor } from "../common/waitFor";

export class DeselectAllWalks implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      SelectCheckbox.unchecked().from(WalksTargets.selectAll));
  }

  toString() {
    return "#actor deselects all walks";
  }

}
