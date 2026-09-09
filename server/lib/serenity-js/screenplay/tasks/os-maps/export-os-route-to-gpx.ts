import { Check, Task, Wait } from "@serenity-js/core";
import { isVisible } from "@serenity-js/web";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";
import { CaptureOsMapsGpxDownload } from "./capture-os-maps-gpx-download";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";
import { ClickOsMapsControlResiliently } from "./click-os-maps-control-resiliently";
import { DismissOsMapsOverlays } from "./dismiss-os-maps-overlays";
import { WaitForOsMapsApplicationReady } from "./wait-for-os-maps-application-ready";

export class ExportOsRouteToGpx {

  static asGpx(): Task {
    return Task.where("#actor exports the current OS Maps route as GPX",
      CaptureOsMapsGpxDownload.duringActivity(
        ClearOsMapsObstructions.before(
          WaitForOsMapsApplicationReady.now(),
          Wait.until(OsMapsPageElements.exportGpxButton, isVisible()),
          ClickOsMapsControlResiliently.on(OsMapsPageElements.exportGpxButton),
          DismissOsMapsOverlays.afterOpeningExport(),
          Check.whether(OsMapsPageElements.confirmExportGpxButton, isVisible())
            .andIfSo(
              ClickOsMapsControlResiliently.on(OsMapsPageElements.confirmExportGpxButton)
            )
        )
      )
    );
  }

}
