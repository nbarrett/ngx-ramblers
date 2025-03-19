import { Answerable, Duration, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Click, isClickable, PageElement } from "@serenity-js/web";

export class ClickWhenReady extends Task {

  static on(target: Answerable<PageElement>) {
    return new ClickWhenReady(target);
  }

  constructor(private target: Answerable<PageElement>) {
    super(`#actor clicks on ${target} when ready`);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Wait.until(this.target, isClickable()),
      Click.on(this.target));
  }

}
