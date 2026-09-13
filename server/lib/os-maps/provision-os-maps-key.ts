import debug from "debug";
import { chromium } from "playwright";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { OsMapsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { connectToEnvironmentMongo, loadEnvironmentContext } from "../environment-setup/environment-context";

const debugLog = debug(envConfig.logNamespace("os-maps:provision-key"));

export async function osMapsConfigFromPlatform(): Promise<OsMapsConfig> {
  const platform = await systemConfig();
  const osMaps = platform.externalSystems?.osMaps || {};
  return {apiKey: osMaps.apiKey || "", email: osMaps.email || "", password: osMaps.password || ""};
}

export async function generateOsMapsApiKey(projectName: string, email: string, password: string): Promise<string | null> {
  if (!email || !password) {
    return null;
  } else {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage();
    await page.goto("https://osdatahub.os.uk/", {waitUntil: "domcontentloaded", timeout: 60000});
    const login = page.getByRole("link", {name: /log in/i}).or(page.getByRole("button", {name: /log in/i}));
    if (await login.first().isVisible()) {
      await login.first().click();
    }
    await page.locator("#signInName, input[type=email]").first().fill(email);
    await page.locator("#password, input[type=password]").first().fill(password);
    await page.locator("#next, button[type=submit]").first().click();
    await page.waitForLoadState("networkidle");
    await page.goto("https://osdatahub.os.uk/account/apiProjects", {waitUntil: "domcontentloaded", timeout: 60000});
    const create = page.getByRole("button", {name: /create a new project|create project/i});
    if (await create.first().isVisible()) {
      await create.first().click();
      await page.getByRole("textbox").first().fill(projectName);
      await page.getByRole("button", {name: /create/i}).last().click();
      await page.waitForLoadState("networkidle");
    }
    const key = await page.locator("text=/API Key/i").locator("xpath=following::*[self::code or self::input or self::span][1]").first().inputValue().catch(async () => {
      return page.locator("code, input[readonly]").first().inputValue().catch(() => page.locator("code").first().innerText());
    });
    const trimmed = (key || "").trim();
    debugLog("generated key length %s for %s", trimmed.length, projectName);
    return trimmed || null;
  } catch (error) {
    debugLog("generateOsMapsApiKey failed: %s", (error as Error).message);
    return null;
  } finally {
    await browser.close();
  }
  }
}

export async function osMapsConfigForEnvironment(environmentName: string): Promise<OsMapsConfig> {
  const platform = await osMapsConfigFromPlatform();
  const generated = await generateOsMapsApiKey(`ngx-ramblers-${environmentName}`, platform.email, platform.password);
  return {
    apiKey: generated || platform.apiKey || "",
    email: platform.email || "",
    password: platform.password || ""
  };
}

export async function ensureOsMapsApiKey(environmentName: string): Promise<OsMapsConfig> {
  const context = await loadEnvironmentContext(environmentName);
  const connection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    const system = await connection.db.collection("config").findOne({key: ConfigKey.SYSTEM});
    if (system?.value?.externalSystems?.osMaps?.apiKey) {
      return system.value.externalSystems.osMaps;
    } else {
      const osMaps = await osMapsConfigForEnvironment(environmentName);
      await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {
        "value.externalSystems.osMaps.apiKey": osMaps.apiKey,
        "value.externalSystems.osMaps.email": osMaps.email,
        "value.externalSystems.osMaps.password": osMaps.password
      }});
      return osMaps;
    }
  } finally {
    await connection.client.close();
  }
}
