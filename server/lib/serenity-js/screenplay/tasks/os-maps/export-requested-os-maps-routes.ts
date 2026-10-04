import debug from "debug";
import { Ensure, equals, includes, isGreaterThan } from "@serenity-js/assertions";
import { Interaction, PerformsActivities, Task } from "@serenity-js/core";
import { OsMapsExportProgress, OsMapsRouteFixture, osMapsExportProgressMessage } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { envConfig } from "../../../../env-config/env-config";
import { ExportedGpxFile } from "../../questions/os-maps/exported-gpx-file";
import { ExportedGpxValidator } from "../../questions/os-maps/exported-gpx-validator";
import { clearExportedGpx } from "../../questions/os-maps/exported-gpx-store";
import { NavigateWithDomLoaded } from "../common/navigate-with-dom-loaded";
import { SaveBrowserSource } from "../common/save-browser-source";
import { ExportOsRouteToGpx } from "./export-os-route-to-gpx";

const debugLog = debug(envConfig.logNamespace("export-requested-os-maps-routes"));
debugLog.enabled = true;

export class ExportRequestedOsMapsRoutes extends Task {
  static from(routes: OsMapsRouteFixture[]): Task {
    return new ExportRequestedOsMapsRoutes(routes);
  }

  constructor(private readonly routes: OsMapsRouteFixture[]) {
    super("#actor converts the requested OS Maps routes");
  }

  async performAs(actor: PerformsActivities): Promise<void> {
    const progress: OsMapsExportProgress = {converted: 0, failed: 0, total: this.routes.length};
    const failures: Error[] = [];
    await this.reportProgress(actor, progress);
    for (const route of this.routes) {
      clearExportedGpx();
      try {
        await actor.attemptsTo(
          NavigateWithDomLoaded.to(route.url),
          ExportOsRouteToGpx.asGpx(),
          Ensure.that(ExportedGpxFile.fileName(), includes(".gpx")),
          Ensure.that(ExportedGpxFile.creator(), includes("OS Maps")),
          Ensure.that(ExportedGpxFile.trackPointCount(), isGreaterThan(route.minimumTrackPoints - 1)),
          Ensure.that(ExportedGpxFile.waypointCount(), isGreaterThan(route.minimumWaypoints - 1)),
          Ensure.that(ExportedGpxValidator.matches(route), equals(true))
        );
        progress.converted += 1;
      } catch (error) {
        const failure = new Error(`OS Maps route ${route.id} could not be converted: ${(error as Error).message}`);
        failures.push(failure);
        progress.failed += 1;
        debugLog(failure.message);
        await actor.attemptsTo(SaveBrowserSource.toFile(`os-maps-export-route-${route.id}-failed.html`));
      }
      await this.reportProgress(actor, progress);
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `${osMapsExportProgressMessage(progress)}. ${failures.map(error => error.message).join("; ")}`);
    }
  }

  private async reportProgress(actor: PerformsActivities, progress: OsMapsExportProgress): Promise<void> {
    const message = osMapsExportProgressMessage(progress);
    await actor.attemptsTo(Interaction.where(message, async () => {
      debugLog(message);
    }));
  }
}
