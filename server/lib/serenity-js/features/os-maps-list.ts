import { afterEach, describe, it, test } from "@serenity-js/playwright-test";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { SaveBrowserSource } from "../screenplay/tasks/common/save-browser-source";
import { Start } from "../screenplay/tasks/common/start";
import { AcceptOsMapsCookies } from "../screenplay/tasks/os-maps/accept-os-maps-cookies";
import { ListOsMapsRoutes } from "../screenplay/tasks/os-maps/list-os-maps-routes";
import { LoginToOsMaps } from "../screenplay/tasks/os-maps/login-to-os-maps";
import { resolveSerenityActorName } from "../resolve-actor-name";
import { OS_MAPS_SCENARIO_TIMEOUT } from "../config/serenity-timeouts";

const osMapsCredentialsConfigured = !!(
  process.env[Environment.OS_EMAIL] && process.env[Environment.OS_PASSWORD]
);
const actor = resolveSerenityActorName();

describe("OS Maps route listing", () => {

  test.setTimeout(OS_MAPS_SCENARIO_TIMEOUT.inMilliseconds());

  afterEach(async ({ actorCalled }) => {
    await actorCalled(actor).attemptsTo(SaveBrowserSource.toFile("os-maps-list-after.html"));
  });

  it("should login to OS Maps and list saved routes", async ({ actorCalled }) => {
    test.skip(!osMapsCredentialsConfigured, "OS_EMAIL and OS_PASSWORD are not set");
    const exporter = actorCalled(actor);
    await exporter.attemptsTo(
      Start.onOsMaps(),
      AcceptOsMapsCookies.whenVisible(),
      LoginToOsMaps.withConfiguredCredentials(),
      ListOsMapsRoutes.fromAccount()
    );
  });

});
