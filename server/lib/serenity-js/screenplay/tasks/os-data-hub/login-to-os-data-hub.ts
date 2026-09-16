import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { Environment } from "../../../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../../../../env-config/env-config";
import { OsServiceHost } from "../../../../models/os-maps-identity.model";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { clickWithoutWaitingForNavigation } from "../os-maps/os-maps-clicks";
import { completeOsMapsIdentityLogin, osMapsIdentityHost } from "../os-maps/os-maps-identity";

const debugLog = debug(envConfig.logNamespace("login-to-os-data-hub"));
debugLog.enabled = true;

export const OS_DATA_HUB_URL = `https://${OsServiceHost.OS_DATA_HUB}/`;

export async function rejectOsDataHubOptionalCookies(native: NativePage): Promise<void> {
  const reject = native.getByText("Reject", {exact: true});
  if (await reject.first().isVisible().catch(() => false)) {
    await reject.first().click();
  }
}

const SIGN_IN_ATTEMPTS = 3;
const SIGN_IN_REDIRECT_WAIT_MS = 15000;

async function openOsDataHubSignIn(native: NativePage, attempt: number): Promise<void> {
  await clickWithoutWaitingForNavigation(native.getByRole("button", {name: /^log in$/i}).first());
  const reachedSignIn = await native.waitForURL(url => osMapsIdentityHost(url.href), {timeout: SIGN_IN_REDIRECT_WAIT_MS}).then(() => true).catch(() => false);
  if (reachedSignIn) {
    debugLog("reached sign-in after attempt", attempt);
  } else if (attempt < SIGN_IN_ATTEMPTS) {
    debugLog("log in click did not open sign-in on attempt", attempt, "at", native.url());
    await rejectOsDataHubOptionalCookies(native);
    await openOsDataHubSignIn(native, attempt + 1);
  } else {
    throw new Error(`The OS Data Hub Log in button did not open the sign-in page after ${SIGN_IN_ATTEMPTS} attempts (still at ${native.url()})`);
  }
}

export class LoginToOsDataHub extends Interaction {

  static withConfiguredCredentials() {
    return new LoginToOsDataHub();
  }

  constructor() {
    super("#actor logs into the OS Data Hub");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const email = (process.env[Environment.OS_EMAIL] || "").trim();
    const password = (process.env[Environment.OS_PASSWORD] || "").trim();
    if (!email || !password) {
      throw new Error("OS_EMAIL and OS_PASSWORD must be set to sign in to the OS Data Hub");
    } else {
      const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
      const native: NativePage = await currentPage.nativePage();
      const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
      await native.goto(OS_DATA_HUB_URL, {waitUntil: "domcontentloaded", timeout});
      await native.getByRole("button", {name: /^log in$/i}).first().waitFor({state: "visible", timeout});
      await rejectOsDataHubOptionalCookies(native);
      await openOsDataHubSignIn(native, 1);
      debugLog("identity page", native.url());
      await completeOsMapsIdentityLogin(native, email, password, timeout, OsServiceHost.OS_DATA_HUB);
      await native.waitForLoadState("domcontentloaded");
      await rejectOsDataHubOptionalCookies(native);
      debugLog("signed in, now at", native.url());
    }
  }

}
