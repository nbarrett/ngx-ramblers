import { Task } from "@serenity-js/core";
import { CaptureOsMapsGpxDownload } from "./capture-os-maps-gpx-download";
import { DismissOsMapsOverlays } from "./dismiss-os-maps-overlays";
import { StartOsMapsGpxDownload } from "./start-os-maps-gpx-download";
import { WaitForOsMapsSignedInHeader } from "./wait-for-os-maps-signed-in-header";

export class ExportOsRouteToGpx {

  static asGpx(): Task {
    return Task.where("#actor exports the current OS Maps route as GPX",
      DismissOsMapsOverlays.now(),
      WaitForOsMapsSignedInHeader.now(),
      StartOsMapsGpxDownload.now(),
      CaptureOsMapsGpxDownload.now()
    );
  }

}
