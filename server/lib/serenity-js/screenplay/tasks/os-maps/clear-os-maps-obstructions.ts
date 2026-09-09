import { equals } from "@serenity-js/assertions";
import { Activity, Check, Task } from "@serenity-js/core";
import { Click, ExecuteScript } from "@serenity-js/web";
import { ElementIsVisible } from "../../questions/os-maps/element-is-visible";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";

export class ClearOsMapsObstructions {

  static now(): Task {
    return Task.where("#actor clears anything blocking progress on the page",
      Check.whether(ElementIsVisible.of(OsMapsPageElements.cookieAccept), equals(true))
        .andIfSo(
          Click.on(OsMapsPageElements.cookieAccept)
        )
        .otherwise(
          Check.whether(ElementIsVisible.of(OsMapsPageElements.cookieOverlay), equals(true))
            .andIfSo(
              ExecuteScript.sync(() => {
                document.querySelectorAll("#ccc-overlay").forEach(overlay => overlay.remove());
              })
            )
        ),
      Check.whether(ElementIsVisible.of(OsMapsPageElements.subscriptionDismissButton), equals(true))
        .andIfSo(
          Click.on(OsMapsPageElements.subscriptionDismissButton)
        ),
      Check.whether(ElementIsVisible.of(OsMapsPageElements.announcementDismissButton), equals(true))
        .andIfSo(
          Click.on(OsMapsPageElements.announcementDismissButton)
        ),
      Check.whether(ElementIsVisible.of(OsMapsPageElements.newMapTypeDismissButton), equals(true))
        .andIfSo(
          Click.on(OsMapsPageElements.newMapTypeDismissButton)
        )
    );
  }

  static before(...activities: Activity[]): Task {
    return Task.where("#actor performs each step with obstructions kept cleared",
      ...activities.flatMap(activity => [ClearOsMapsObstructions.now(), activity])
    );
  }

}
