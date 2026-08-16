import { Question } from "@serenity-js/core";
import { OsMapsRouteFixture } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { gpxMatchesRoute } from "../../../../os-maps/exported-gpx-parser";
import { lastExportedGpx } from "./exported-gpx-store";

export class ExportedGpxValidator {

  static matches(fixture: OsMapsRouteFixture) {
    return Question.about(`the exported GPX matching ${fixture.name}`, () => {
      const summary = lastExportedGpx();
      return gpxMatchesRoute(
        summary,
        fixture.expectedDistanceKm,
        fixture.distanceToleranceKm,
        fixture.minimumTrackPoints,
        fixture.minimumWaypoints
      );
    });
  }

}
