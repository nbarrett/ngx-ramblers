import { PerformsActivities, Task } from "@serenity-js/core";
import { Publish } from "./publish";
import { SelectWalks } from "./selectWalks";

export class PublishWalksInDraftState implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      SelectWalks.withStatus("Draft"),
      Publish.selectedWalks());
  }

  toString() {
    return "#actor publishes Draft walks";
  }
}
