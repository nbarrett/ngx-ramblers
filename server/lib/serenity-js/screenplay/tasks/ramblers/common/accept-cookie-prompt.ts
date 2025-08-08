import { not } from "@serenity-js/assertions";
import { Check, Task, Wait } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ExecuteScript, isVisible } from "@serenity-js/web";

export class Accept {
  static cookieBannerIfVisible(): Task {
    return Task.where("#actor accepts the cookie banner if visible",
      Check.whether(WalksPageElements.cookieBannerAccept, isVisible())
        .andIfSo(
          ExecuteScript.sync(`document.querySelector('.cky-btn-accept').click();`),
          Wait.until(WalksPageElements.cookieBannerAccept, not(isVisible())),
          Wait.until(WalksPageElements.cookieBannerContainer, not(isVisible()))));
  }
}
