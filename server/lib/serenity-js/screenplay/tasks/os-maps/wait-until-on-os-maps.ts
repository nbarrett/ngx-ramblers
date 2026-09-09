import { includes, isPresent, not } from "@serenity-js/assertions";
import { Check, Task, Wait } from "@serenity-js/core";
import { isVisible, Page } from "@serenity-js/web";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";

export class WaitUntilOnOsMaps {

  static site(): Task {
    return Task.where("#actor waits until the OS Maps site has loaded",
      Wait.until(Page.whichUrl(includes("explore.osmaps.com")), isPresent()),
      Check.whether(OsMapsPageElements.applicationHeader, isVisible())
        .andIfSo(
          Wait.until(OsMapsPageElements.loginButton, not(isVisible()))
        )
    );
  }

}
