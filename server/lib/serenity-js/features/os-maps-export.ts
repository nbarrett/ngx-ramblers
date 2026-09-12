import { Ensure, equals, includes, isGreaterThan } from "@serenity-js/assertions";
import { afterEach, describe, it, test } from "@serenity-js/playwright-test";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { OsMapsRouteFixture, requestedOsMapsRouteFixture } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
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

function exportRoutes(): OsMapsRouteFixture[] {
  const requestedUrls = process.env[Environment.OS_MAPS_ROUTE_URLS];
  const requestedUrl = process.env[Environment.OS_MAPS_ROUTE_URL];
  if (requestedUrls) {
    const uniqueUrls: string[] = JSON.parse(requestedUrls).filter((url: string, index: number, all: string[]) => all.indexOf(url) === index);
    return uniqueUrls.map(url => requestedOsMapsRouteFixture(url));
  } else if (requestedUrl) {
    return [requestedOsMapsRouteFixture(requestedUrl)];
  } else {
    return [];
  }
}

describe("OS Maps GPX export", () => {

  afterEach(async ({ actorCalled }) => {
    clearExportedGpx();
    await actorCalled(actor).attemptsTo(SaveBrowserSource.toFile("os-maps-export-after.html"));
  });

  it("should login once and export each requested OS Maps route as GPX", async ({ actorCalled }) => {
    test.skip(!osMapsCredentialsConfigured, "OS_EMAIL and OS_PASSWORD are not set");
    const routes = exportRoutes();
    test.skip(routes.length === 0, "No OS Maps routes were requested");
    const exporter = actorCalled(actor);
    await exporter.attemptsTo(
      Start.onOsMapsRoute(routes[0].url),
      AcceptOsMapsCookies.whenVisible(),
      LoginToOsMaps.withConfiguredCredentials()
    );
    for (const route of routes) {
      clearExportedGpx();
      await exporter.attemptsTo(
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
    }
  });

});
