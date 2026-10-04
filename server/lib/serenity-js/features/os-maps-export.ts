import { afterEach, describe, it, test } from "@serenity-js/playwright-test";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { OsMapsRouteFixture, requestedOsMapsRouteFixture } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";
import { Start } from "../screenplay/tasks/common/start";
import { ExportRequestedOsMapsRoutes } from "../screenplay/tasks/os-maps/export-requested-os-maps-routes";
import { LoginToOsMaps } from "../screenplay/tasks/os-maps/login-to-os-maps";
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

  test.setTimeout(0);

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
      LoginToOsMaps.withConfiguredCredentials()
    );
    await exporter.attemptsTo(ExportRequestedOsMapsRoutes.from(routes));
  });

});
