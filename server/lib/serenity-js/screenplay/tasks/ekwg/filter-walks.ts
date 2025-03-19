import { PerformsActivities, Task } from "@serenity-js/core";
import { WalksProgrammeTargets } from "../../ui/ekwg/walks-programme-targets";
import { Enter } from "@serenity-js/web";

export class FilterWalks extends Task {

  static toShowOnly(itemName: string) {
    return new FilterWalks(itemName);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Enter.theValue(this.searchTerm)
        .into(WalksProgrammeTargets.quickSearch),
    );
  }

  constructor(private searchTerm: string) {
    super(`{0} filters the walks to show items matching #searchTerm"`);
  }
}
