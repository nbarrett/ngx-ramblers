import { Answerable, Duration, PerformsActivities, Task, Wait } from "@serenity-js/core";
import { Click, isClickable, PageElement } from "@serenity-js/web";
import { Accept } from "../ramblers/common/accept-cookie-prompt";

export class ClickWhenReady extends Task {

  static on(target: Answerable<PageElement>) {
    return new ClickWhenReady(target);
  }

  constructor(private target: Answerable<PageElement>) {
    super(`#actor clicks on ${target} when ready`);
  }

  performAs(actor: PerformsActivities): Promise<void> {
    return actor.attemptsTo(
      Accept.forceDismissCookieBanners(),
      Accept.cookieBannerIfVisible(),
      Wait.until(this.target, isClickable()),
      Click.on(this.target));
  }

}
