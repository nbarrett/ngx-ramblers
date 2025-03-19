import { Answerable, Duration, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Click, isClickable, PageElement } from "@serenity-js/web";

export class ClickWhenReady extends Task {

  static on(target: Answerable<PageElement>) {
    return new ClickWhenReady(target);
  }

  constructor(private target: Answerable<PageElement>) {
    super(ClickWhenReady.toString());
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Wait.upTo(Duration.ofSeconds(10)).until(this.target, isClickable()),
      Click.on(this.target));
  }

  toString() {
    return `#actor clicks on ${this.target} when ready`;
  }
}
