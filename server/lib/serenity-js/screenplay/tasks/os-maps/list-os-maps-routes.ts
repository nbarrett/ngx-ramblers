import { AnswersQuestions, Interaction, PerformsActivities, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import { Navigate } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import * as fs from "fs";
import * as path from "path";
import debug from "debug";
import { isArray, isObject, toPairs } from "es-toolkit/compat";
import { envConfig } from "../../../../env-config/env-config";
import { Environment } from "../../../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { OsMapsRouteSource } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { listedRoutesFromSearchPayload } from "../../../../os-maps/os-maps-route-list";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";

const debugLog = debug(envConfig.logNamespace("list-os-maps-routes"));
debugLog.enabled = true;

const REDACTED_KEYS = new Set(["name", "title"]);

function withNamesRedacted(value: unknown, depth = 0): unknown {
  if (depth >= 4 || !isObject(value)) {
    return value;
  } else if (isArray(value)) {
    return value.map(entry => withNamesRedacted(entry, depth + 1));
  } else {
    return Object.fromEntries(toPairs(value as Record<string, unknown>).map(([key, entryValue]) =>
      [key, REDACTED_KEYS.has(key) ? "[redacted]" : withNamesRedacted(entryValue, depth + 1)]));
  }
}

export class ListOsMapsRoutes extends Interaction {

  static fromAccount() {
    return new ListOsMapsRoutes();
  }

  constructor() {
    super("#actor lists OS Maps routes from the signed-in account");
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    const searchPromise = native.waitForResponse(response => {
      return response.url().includes("route-api/v1/routes/search") && response.ok();
    }, {timeout});
    await actor.attemptsTo(
      Navigate.to("https://explore.osmaps.com/my-routes?routeType=created&sortSelect=dateCreated"),
      ClearOsMapsObstructions.now()
    );
    const response = await searchPromise;
    const payload = await response.json();
    const firstRecord = (payload as {content?: unknown[]})?.content?.[0];
    debugLog("routes/search first record, route names redacted:", JSON.stringify(withNamesRedacted(firstRecord)));
    const routes = listedRoutesFromSearchPayload(payload, OsMapsRouteSource.CREATED);
    const jobPath = process.env[Environment.OS_MAPS_JOB_PATH];
    if (!jobPath) {
      throw new Error("OS_MAPS_JOB_PATH is not set");
    } else {
      fs.mkdirSync(jobPath, {recursive: true});
      fs.writeFileSync(path.join(jobPath, "listed-routes.json"), JSON.stringify(routes, null, 2));
    }
  }

}
