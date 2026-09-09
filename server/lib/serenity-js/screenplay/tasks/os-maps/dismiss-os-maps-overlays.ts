import { Check, Task } from "@serenity-js/core";
import { isVisible } from "@serenity-js/web";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";
import { ClickOsMapsControlResiliently } from "./click-os-maps-control-resiliently";

export class DismissOsMapsOverlays {

  static afterOpeningExport(): Task {
    return Task.where("#actor dismisses any OS Maps export interruptions",
      ClearOsMapsObstructions.now(),
      Check.whether(OsMapsPageElements.exportGpxButton, isVisible())
        .andIfSo(
          ClickOsMapsControlResiliently.on(OsMapsPageElements.exportGpxButton)
        )
    );
  }

}
