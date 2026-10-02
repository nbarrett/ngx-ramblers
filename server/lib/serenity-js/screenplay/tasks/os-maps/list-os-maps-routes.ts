import { Interaction, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import * as fs from "fs";
import * as path from "path";
import { Environment } from "../../../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { OsMapsRouteSearchRequest, OsMapsRouteSource } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { allListedRoutesFromSearchPages } from "../../../../os-maps/os-maps-route-list";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";

export class ListOsMapsRoutes extends Task {

  static fromAccount() {
    return new ListOsMapsRoutes();
  }

  constructor() {
    super("#actor lists OS Maps routes from the signed-in account");
  }

  async performAs(actor: UsesAbilities & PerformsActivities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    const searchPromise = native.waitForResponse(response => {
      return response.url().includes("route-api/v1/routes/search") && response.ok();
    }, {timeout});
    await native.goto("https://explore.osmaps.com/my-routes?routeType=created&sortSelect=dateCreated", {
      waitUntil: "domcontentloaded",
      timeout
    });
    await clearOsMapsInterruptions(native);
    const response = await searchPromise;
    const payload = await response.json();
    const request = response.request();
    const requestBody = request.postDataJSON() as OsMapsRouteSearchRequest;
    const headers = await request.allHeaders();
    const routes = await allListedRoutesFromSearchPages(payload, OsMapsRouteSource.CREATED, async pageNumber => {
      const result = {payload: null as unknown};
      await actor.attemptsTo(Interaction.where(`#actor lists OS Maps route page ${pageNumber + 1}`, async () => {
        const nextResponse = await native.context().request.post(request.url(), {
          headers,
          data: {...requestBody, pageParameters: {...requestBody.pageParameters, page: pageNumber}},
          timeout
        });
        if (!nextResponse.ok()) {
          throw new Error(`OS Maps route page ${pageNumber + 1} could not be loaded (HTTP ${nextResponse.status()})`);
        } else {
          result.payload = await nextResponse.json();
        }
      }));
      return result.payload;
    });
    const jobPath = process.env[Environment.OS_MAPS_JOB_PATH];
    if (!jobPath) {
      throw new Error("OS_MAPS_JOB_PATH is not set");
    } else {
      fs.mkdirSync(jobPath, {recursive: true});
      fs.writeFileSync(path.join(jobPath, "listed-routes.json"), JSON.stringify(routes, null, 2));
    }
  }

}
