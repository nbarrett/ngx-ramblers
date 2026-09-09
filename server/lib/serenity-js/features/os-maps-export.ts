import { Ensure, equals, includes, isGreaterThan } from "@serenity-js/assertions";
import { afterEach, describe, it, test } from "@serenity-js/playwright-test";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { OsMapsRouteFixture, requestedOsMapsRouteFixture } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { Start } from "../screenplay/tasks/common/start";
import { ExportOsRouteToGpx } from "../screenplay/tasks/os-maps/export-os-route-to-gpx";
import { LoginToOsMaps } from "../screenplay/tasks/os-maps/login-to-os-maps";
import { ClearOsMapsObstructions } from "../screenplay/tasks/os-maps/clear-os-maps-obstructions";
import { ExportedGpxFile } from "../screenplay/questions/os-maps/exported-gpx-file";
import { ExportedGpxValidator } from "../screenplay/questions/os-maps/exported-gpx-validator";
import { clearExportedGpx } from "../screenplay/questions/os-maps/exported-gpx-store";
import { resolveSerenityActorName } from "../resolve-actor-name";
import { OS_MAPS_SCENARIO_TIMEOUT } from "../config/serenity-timeouts";
import { Navigate } from "@serenity-js/web";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";
import { SaveOsMapsNetworkActivity, StartCapturingOsMapsNetworkActivity } from "../screenplay/tasks/os-maps/capture-os-maps-network-activity";

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
    await actorCalled(actor).attemptsTo(
      SaveBrowserSource.toFile("after-all.html"),
      SaveOsMapsNetworkActivity.toFile("network-activity.json")
    );
  });

  test.setTimeout(OS_MAPS_SCENARIO_TIMEOUT.inMilliseconds());

  it("should log into OS Maps once and export each requested route as GPX", async ({ actorCalled }) => {
    test.skip(!osMapsCredentialsConfigured, "OS_EMAIL and OS_PASSWORD are not set");
    const routes = exportRoutes();
    test.skip(routes.length === 0, "No OS Maps routes were requested");
    const exporter = actorCalled(actor);
    await exporter.attemptsTo(
      Start.onOsMapsRoute(routes[0].url),
      StartCapturingOsMapsNetworkActivity.now(),
      LoginToOsMaps.withConfiguredCredentials()
    );
    for (const route of routes) {
      clearExportedGpx();
      await exporter.attemptsTo(
        Navigate.to(route.url),
        ClearOsMapsObstructions.now(),
        LoginToOsMaps.withConfiguredCredentials(),
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
