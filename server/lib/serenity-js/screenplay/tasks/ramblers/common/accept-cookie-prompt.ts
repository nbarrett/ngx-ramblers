import { not } from "@serenity-js/assertions";
import { Check, Task, Wait } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ExecuteScript, isVisible } from "@serenity-js/web";
import { Log } from "./log";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("accept-cookie-prompt"));
export class Accept {
  static disableCookieBannerPermanently(): Task {
    return Task.where("#actor disables cookie banner persistently",
      ExecuteScript.sync(() => {
        try {
          const domainParts = location.hostname.split(".");
          const baseDomain = domainParts.slice(-2).join(".");
          const maxAge = 60 * 60 * 24 * 365;
          const cookieNames = ["cky-consent", "cookieyes-consent"];
          const setCookie = (name: string, value: string) => {
            document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
            document.cookie = `${name}=${value}; path=/; domain=.${baseDomain}; max-age=${maxAge}; SameSite=Lax`;
          };
          cookieNames.forEach(n => setCookie(n, "yes"));
          try {
            localStorage.setItem(cookieNames[0], "yes");
            localStorage.setItem(cookieNames[1], "yes");
          } catch (error) {
            debugLog(`❌ Error setting storage item:`, cookieNames, error);
          }
          const overlay = document.querySelector(".cky-overlay");
          if (overlay) overlay.remove();
          const container = document.querySelector(".cky-consent-container");
          if (container) container.remove();
          const style = document.createElement("style");
          style.textContent = ".cky-overlay,.cky-consent-container{display:none!important;visibility:hidden!important;pointer-events:none!important;}";
          document.head.appendChild(style);
        } catch (e) {
          (window as any).__ckyError = (e as any)?.message || "unknown";
        }
      }),
      Log.message("accept-cookie-prompt: persistent cookie banner suppression executed"),
      Wait.until(WalksPageElements.cookieBannerContainer, not(isVisible())));
  }

  static cookieBannerIfVisible(): Task {
    return Task.where("#actor accepts the cookie banner if visible",
      Check.whether(WalksPageElements.cookieBannerAccept, isVisible())
        .andIfSo(
          Accept.disableCookieBannerPermanently(),
          ExecuteScript.sync(() => {
            const btn = document.querySelector(".cky-btn-accept") as HTMLButtonElement;
            if (btn) btn.click();
          }),
          Wait.until(WalksPageElements.cookieBannerAccept, not(isVisible())),
          Wait.until(WalksPageElements.cookieBannerContainer, not(isVisible()))));
  }

  static forceDismissCookieBanners(): Task {
    return Task.where("#actor force-dismisses cookie banners",
      ExecuteScript.sync(() => {
        try {
          const selectors = [".cky-overlay", ".cky-consent-container", ".cky-modal", ".cky-btn-revisit-wrapper"];
          selectors.forEach(sel => document.querySelectorAll(sel).forEach(n => n.remove()));
          const style = document.createElement("style");
          style.textContent = selectors.join(",") + "{display:none!important;visibility:hidden!important;pointer-events:none!important;}";
          document.head.appendChild(style);
        } catch (e) {
          (window as any).__ckyError = (e as any)?.message || "unknown";
        }
      }),
      Log.message("accept-cookie-prompt: force-dismiss executed"));
  }
}
