import { describe, it, test } from "@serenity-js/playwright-test";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { LoginToOsDataHub } from "../screenplay/tasks/os-data-hub/login-to-os-data-hub";
import { GenerateOsDataHubApiKey } from "../screenplay/tasks/os-data-hub/generate-os-data-hub-api-key";
import { resolveSerenityActorName } from "../resolve-actor-name";
import { OS_MAPS_SCENARIO_TIMEOUT } from "../config/serenity-timeouts";

const osCredentialsConfigured = !!(process.env[Environment.OS_EMAIL] && process.env[Environment.OS_PASSWORD]);
const actor = resolveSerenityActorName();

describe("OS Data Hub API key", () => {

  test.setTimeout(OS_MAPS_SCENARIO_TIMEOUT.inMilliseconds() * 2);

  it("should sign in to the OS Data Hub and generate an OS Maps API key for the project", async ({ actorCalled }) => {
    test.skip(!osCredentialsConfigured, "OS_EMAIL and OS_PASSWORD are not set");
    await actorCalled(actor).attemptsTo(
      LoginToOsDataHub.withConfiguredCredentials(),
      GenerateOsDataHubApiKey.forConfiguredProject()
    );
  });

});
