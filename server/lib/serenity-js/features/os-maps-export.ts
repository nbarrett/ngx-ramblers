import { Ensure, equals, includes, isGreaterThan } from "@serenity-js/assertions";
import { afterEach, describe, it, test } from "@serenity-js/playwright-test";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { ELHAM_VALLEY_NORTH_ROUTE, OS_MAPS_EXPORT_ROUTES, OsMapsRouteFixture } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { NavigateWithDomLoaded } from "../screenplay/tasks/common/navigate-with-dom-loaded";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";
import { Start } from "../screenplay/tasks/common/start";
import { AcceptOsMapsCookies } from "../screenplay/tasks/os-maps/accept-os-maps-cookies";
import { DismissOsMapsOverlays } from "../screenplay/tasks/os-maps/dismiss-os-maps-overlays";
import { ExportOsRouteToGpx } from "../screenplay/tasks/os-maps/export-os-route-to-gpx";
import { LoginToOsMaps } from "../screenplay/tasks/os-maps/login-to-os-maps";
import { ExportedGpxFile } from "../screenplay/questions/os-maps/exported-gpx-file";
import { ExportedGpxValidator } from "../screenplay/questions/os-maps/exported-gpx-validator";
import { clearExportedGpx } from "../screenplay/questions/os-maps/exported-gpx-store";
import { resolveSerenityActorName } from "../resolve-actor-name";

const osMapsCredentialsConfigured = !!(
  process.env[Environment.OS_EMAIL] && process.env[Environment.OS_PASSWORD]
);
const actor = resolveSerenityActorName();

function fixtureForUrl(requestedUrl: string): OsMapsRouteFixture {
  const known = OS_MAPS_EXPORT_ROUTES.find(route => requestedUrl.includes(`/route/${route.id}`));
  if (known) {
    return {...known, url: requestedUrl};
  } else {
    return {
      ...ELHAM_VALLEY_NORTH_ROUTE,
      id: 0,
      name: "Requested OS Maps route",
      url: requestedUrl,
      expectedDistanceKm: 0,
      minimumTrackPoints: 1,
      minimumWaypoints: 0,
      distanceToleranceKm: Number.MAX_SAFE_INTEGER
    };
  }
}

function exportRoutes(): OsMapsRouteFixture[] {
  const requestedUrls = process.env[Environment.OS_MAPS_ROUTE_URLS];
  const requestedUrl = process.env[Environment.OS_MAPS_ROUTE_URL];
  if (requestedUrls) {
    return JSON.parse(requestedUrls).map((url: string) => fixtureForUrl(url));
  } else if (requestedUrl) {
    return [fixtureForUrl(requestedUrl)];
  } else {
    return OS_MAPS_EXPORT_ROUTES;
  }
}

describe("OS Maps GPX export", () => {

  afterEach(async ({ actorCalled }) => {
    clearExportedGpx();
    await actorCalled(actor).attemptsTo(SaveBrowserSource.toFile("os-maps-export-after.html"));
  });

  exportRoutes().forEach(route => {
    it(`should login, export ${route.name} (${route.id}) as GPX and validate the file`, async ({ actorCalled }) => {
      test.skip(!osMapsCredentialsConfigured, "OS_EMAIL and OS_PASSWORD are not set");
      const exporter = actorCalled(actor);
      await exporter.attemptsTo(
        Start.onOsMapsRoute(route.url),
        AcceptOsMapsCookies.whenVisible(),
        LoginToOsMaps.withConfiguredCredentials(),
        NavigateWithDomLoaded.to(route.url),
        AcceptOsMapsCookies.whenVisible(),
        DismissOsMapsOverlays.now(),
        ExportOsRouteToGpx.asGpx(),
        Ensure.that(ExportedGpxFile.fileName(), includes(".gpx")),
        Ensure.that(ExportedGpxFile.creator(), includes("OS Maps")),
        Ensure.that(ExportedGpxFile.trackPointCount(), isGreaterThan(route.minimumTrackPoints - 1)),
        Ensure.that(ExportedGpxFile.waypointCount(), isGreaterThan(route.minimumWaypoints - 1)),
        Ensure.that(ExportedGpxValidator.matches(route), equals(true))
      );
    });
  });

});
