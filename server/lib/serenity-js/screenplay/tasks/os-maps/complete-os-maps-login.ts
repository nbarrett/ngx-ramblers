import debug from "debug";
import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import { envConfig } from "../../../../env-config/env-config";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { clearOsMapsInterruptions } from "./os-maps-page-cleanup";
import {
  clickOsMapsExploreLogin,
  fillOsMapsIdentityField,
  osMapsEmailField,
  osMapsIdentityErrorText,
  osMapsIdentityHost,
  osMapsPasswordField,
  osMapsSessionIsSignedIn,
  pageShowingOsMapsIdentity,
  submitOsMapsIdentityForm,
  waitForOsMapsApplicationReady,
  waitForOsMapsIdentityForm,
  waitForOsMapsSignedIn
} from "./os-maps-identity";

const debugLog = debug(envConfig.logNamespace("complete-os-maps-login"));
debugLog.enabled = true;

export class CompleteOsMapsLogin extends Interaction {

  static with(email: string, password: string) {
    return new CompleteOsMapsLogin(email, password);
  }

  constructor(private readonly email: string, private readonly password: string) {
    super("#actor completes OS Maps identity login");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const timeout = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    await clearOsMapsInterruptions(native);
    await waitForOsMapsApplicationReady(native, timeout);
    if (await osMapsSessionIsSignedIn(native)) {
      debugLog("already signed in at", native.url());
    } else {
      const loginPage = await this.openIdentityPage(native, timeout);
      debugLog("identity page", loginPage.url());
      await waitForOsMapsIdentityForm(loginPage, timeout);
      await fillOsMapsIdentityField(loginPage, osMapsEmailField(loginPage), this.email, timeout);
      await fillOsMapsIdentityField(loginPage, osMapsPasswordField(loginPage), this.password, timeout);
      await submitOsMapsIdentityForm(loginPage, timeout);
      const rejected = await osMapsIdentityErrorText(loginPage);
      if (rejected) {
        throw new Error(`OS Maps login was rejected: ${rejected}`);
      } else if (loginPage !== native) {
        await loginPage.waitForEvent("close", {timeout}).catch(() => null);
      }
      await native.waitForURL(url => url.hostname === "explore.osmaps.com", {timeout}).catch(() => null);
      await waitForOsMapsSignedIn(native, timeout);
    }
  }

  private async openIdentityPage(native: NativePage, timeout: number): Promise<NativePage> {
    const existing = await pageShowingOsMapsIdentity(native);
    if (existing) {
      debugLog("already on identity", existing.url());
      return existing;
    } else {
      const opened = {page: null as NativePage | null};
      const popupWait = native.context().waitForEvent("page", {timeout: 10000}).then(page => {
        opened.page = page;
        return page;
      }).catch(() => null);
      await clickOsMapsExploreLogin(native, timeout);
      await Promise.race([
        popupWait,
        native.waitForURL(url => osMapsIdentityHost(url.href), {timeout: 15000}).then(() => native),
        osMapsEmailField(native).first().waitFor({state: "visible", timeout: 15000}).then(() => native)
      ]).catch(() => null);
      if (opened.page) {
        debugLog("identity opened in a new page", opened.page.url());
        await opened.page.waitForLoadState("domcontentloaded");
        return opened.page;
      } else if (osMapsIdentityHost(native.url()) || await osMapsEmailField(native).first().isVisible().catch(() => false)) {
        return native;
      } else {
        const later = await pageShowingOsMapsIdentity(native);
        if (later) {
          return later;
        } else {
          await osMapsEmailField(native).first().waitFor({state: "visible", timeout});
          return native;
        }
      }
    }
  }

}
