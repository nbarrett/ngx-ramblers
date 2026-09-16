import * as fs from "fs";
import * as path from "path";
import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { Environment } from "../../../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../../../../env-config/env-config";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { OS_DATA_HUB_URL, rejectOsDataHubOptionalCookies } from "./login-to-os-data-hub";
import { OS_DATA_HUB_API_KEY_FILE } from "../../../../os-maps/os-data-hub-api-key-store";

const debugLog = debug(envConfig.logNamespace("generate-os-data-hub-api-key"));
debugLog.enabled = true;


async function saveStep(native: NativePage, jobPath: string, name: string): Promise<void> {
  fs.writeFileSync(path.join(jobPath, `${name}.url.txt`), native.url());
  await native.screenshot({path: path.join(jobPath, `${name}.png`), fullPage: true}).catch(() => null);
}

export class GenerateOsDataHubApiKey extends Interaction {

  static forConfiguredProject() {
    return new GenerateOsDataHubApiKey();
  }

  constructor() {
    super("#actor generates an OS Maps API key in the OS Data Hub");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const projectName = (process.env[Environment.OS_DATA_HUB_PROJECT_NAME] || "").trim();
    const jobPath = process.env[Environment.OS_MAPS_JOB_PATH];
    if (!projectName || !jobPath) {
      throw new Error("OS_DATA_HUB_PROJECT_NAME and OS_MAPS_JOB_PATH must be set to generate an OS Maps API key");
    } else {
      const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
      const native: NativePage = await currentPage.nativePage();
      const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
      fs.mkdirSync(jobPath, {recursive: true});
      const projectCreated = await this.openProject(native, projectName, jobPath, timeout);
      const apiAdded = await this.ensureOsMapsApi(native, jobPath, timeout);
      const apiKey = await this.projectApiKey(native, timeout);
      fs.writeFileSync(path.join(jobPath, OS_DATA_HUB_API_KEY_FILE), JSON.stringify({projectName, apiKey, created: projectCreated || apiAdded}));
      debugLog("stored the API key for project %s (%d characters)", projectName, apiKey.length);
    }
  }

  private async openProject(native: NativePage, projectName: string, jobPath: string, timeout: number): Promise<boolean> {
    await native.goto(`${OS_DATA_HUB_URL}data/apis/projects`, {waitUntil: "networkidle", timeout});
    await rejectOsDataHubOptionalCookies(native);
    const existing = native.getByRole("link", {name: projectName, exact: true});
    const exists = await existing.first().isVisible().catch(() => false);
    if (exists) {
      debugLog("project %s already exists", projectName);
      await existing.first().click();
    } else {
      debugLog("creating project %s", projectName);
      await native.getByRole("button", {name: /create a new project/i}).first().click();
      await native.getByPlaceholder(/enter a name/i).waitFor({state: "visible", timeout});
      await native.getByPlaceholder(/enter a name/i).fill(projectName);
      await native.getByRole("button", {name: /^create project$/i}).click();
    }
    await native.getByRole("button", {name: /^add api$/i}).first().waitFor({state: "visible", timeout}).catch(async error => {
      await saveStep(native, jobPath, "project-not-opened");
      throw error;
    });
    return !exists;
  }

  private async ensureOsMapsApi(native: NativePage, jobPath: string, timeout: number): Promise<boolean> {
    const keyShown = await native.getByRole("button", {name: "Copy 'Project API Key' to Clipboard"}).first().isVisible().catch(() => false);
    if (keyShown) {
      debugLog("project already has an API and a key");
      return false;
    } else {
      await native.getByRole("button", {name: /^add api$/i}).first().click();
      const addOsMaps = native.locator("xpath=//h2[normalize-space()='OS Maps API']/ancestor::*[.//button[normalize-space()='Add to project']][1]//button[normalize-space()='Add to project']").first();
      await addOsMaps.waitFor({state: "visible", timeout}).catch(async error => {
        await saveStep(native, jobPath, "add-api-catalogue");
        throw error;
      });
      await addOsMaps.click();
      const done = native.getByRole("button", {name: /^done$/i}).first();
      await done.waitFor({state: "visible", timeout});
      await done.click();
      debugLog("added the OS Maps API to the project");
      return true;
    }
  }

  private async projectApiKey(native: NativePage, timeout: number): Promise<string> {
    const copyButton = native.getByRole("button", {name: "Copy 'Project API Key' to Clipboard"}).first();
    await copyButton.waitFor({state: "visible", timeout});
    const apiKey = ((await copyButton.locator("xpath=preceding-sibling::p[1]").innerText()) || "").trim();
    if (!apiKey) {
      throw new Error("The OS Data Hub project page did not show a Project API Key");
    } else {
      return apiKey;
    }
  }

}
