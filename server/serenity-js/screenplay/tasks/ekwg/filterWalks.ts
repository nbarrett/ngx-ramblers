import { PerformsActivities, Task } from "@serenity-js/core";
import { Enter } from "@serenity-js/protractor";
import { WalksProgrammeTargets } from "../../ui/ekwg/walksProgrammeTargets";

export class FilterWalks implements Task {

  static toShowOnly(itemName: string) {
    return new FilterWalks(itemName);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Enter.theValue(this.searchTerm)
        .into(WalksProgrammeTargets.quickSearch),
    );
  }

  toString() {
    return `{0} filters the walks to show items matching #searchTerm"`;
  }

  constructor(private searchTerm: string) {
  }
}
