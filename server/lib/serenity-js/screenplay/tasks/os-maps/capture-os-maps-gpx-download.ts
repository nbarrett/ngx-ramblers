import { Activity, AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import type { PlaywrightPage } from "@serenity-js/playwright";
import { BrowseTheWeb, Navigate, Page } from "@serenity-js/web";
import type { Download, Page as NativePage } from "playwright-core";
import { isString } from "es-toolkit/compat";
import { osMapsRouteIdFromUrl } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { parseExportedGpx } from "../../../../os-maps/exported-gpx-parser";
import { persistExportedGpxToJobPath } from "../../../../os-maps/os-maps-exported-gpx-files";
import { DEFAULT_WAIT_TIMEOUT } from "../../../config/serenity-timeouts";
import { rememberExportedGpx } from "../../questions/os-maps/exported-gpx-store";
import { OS_MAPS_LOGIN_BUTTON_SELECTOR } from "../../ui/os-maps/os-maps-page-elements";
import { ClearOsMapsObstructions } from "./clear-os-maps-obstructions";
import { LoginToOsMaps } from "./login-to-os-maps";

const MAX_SESSION_RECOVERY_ATTEMPTS = 5;
const SESSION_LOSS_DEBOUNCE_MS = 5000;

type DownloadRaceOutcome =
  | {outcome: "download"; download: Download}
  | {outcome: "sessionLost"};

async function detectSustainedSessionLoss(native: NativePage, timeoutMs: number): Promise<DownloadRaceOutcome> {
  return native.evaluate(
    ({selector, debounceMs, timeoutMs}) => new Promise<DownloadRaceOutcome>((resolve, reject) => {
      const isVisible = (element: Element | null): boolean => !!element && !!(element as HTMLElement).offsetParent;
      const state: {settleTimer: number | null} = {settleTimer: null};
      const finish = (): void => {
        observer.disconnect();
        window.clearTimeout(overallTimer);
        if (state.settleTimer !== null) {
          window.clearTimeout(state.settleTimer);
        }
        resolve({outcome: "sessionLost"});
      };
      const evaluate = (): void => {
        const visible = isVisible(document.querySelector(selector));
        if (visible && state.settleTimer === null) {
          state.settleTimer = window.setTimeout(finish, debounceMs);
        } else if (!visible && state.settleTimer !== null) {
          window.clearTimeout(state.settleTimer);
          state.settleTimer = null;
        }
      };
      const observer = new MutationObserver(evaluate);
      observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true});
      const overallTimer = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("OS Maps login button visibility check timed out"));
      }, timeoutMs);
      evaluate();
    }),
    {selector: OS_MAPS_LOGIN_BUTTON_SELECTOR, debounceMs: SESSION_LOSS_DEBOUNCE_MS, timeoutMs}
  );
}

export class CaptureOsMapsGpxDownload extends Task {

  static duringActivity(...activities: Activity[]): CaptureOsMapsGpxDownload {
    return new CaptureOsMapsGpxDownload(activities);
  }

  constructor(private readonly activities: Activity[]) {
    super("#actor downloads the GPX file produced while exporting the route");
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const download = await this.captureWithSessionRecovery(actor, MAX_SESSION_RECOVERY_ATTEMPTS);
    const failure = await download.failure();
    if (failure) {
      throw new Error(`OS Maps GPX download failed: ${failure}`);
    } else {
      const stream = await download.createReadStream();
      if (!stream) {
        throw new Error("OS Maps GPX download did not produce a stream");
      } else {
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(isString(chunk) ? chunk : Buffer.from(chunk).toString("utf8"));
        }
        const fileName = download.suggestedFilename();
        const pageUrl = await actor.answer(Page.current().url().href);
        const summary = {...parseExportedGpx(chunks.join(""), fileName), routeId: osMapsRouteIdFromUrl(pageUrl)};
        rememberExportedGpx(summary);
        persistExportedGpxToJobPath(summary);
      }
    }
  }

  private async captureWithSessionRecovery(
    actor: PerformsActivities & UsesAbilities & AnswersQuestions,
    attemptsRemaining: number,
    routeUrl?: string
  ): Promise<Download> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const currentUrl = routeUrl || await actor.answer(Page.current().url().href);
    const timeoutMs = DEFAULT_WAIT_TIMEOUT.inMilliseconds();
    const downloadOutcome: Promise<DownloadRaceOutcome> = native.waitForEvent("download", {timeout: timeoutMs})
      .then(download => ({outcome: "download" as const, download}));
    const sessionLostOutcome: Promise<DownloadRaceOutcome> = detectSustainedSessionLoss(native, timeoutMs);
    downloadOutcome.catch(() => undefined);
    sessionLostOutcome.catch(() => undefined);
    let result: DownloadRaceOutcome;
    try {
      await actor.attemptsTo(...this.activities);
      result = await Promise.race([downloadOutcome, sessionLostOutcome]);
    } catch (error) {
      if (attemptsRemaining <= 1) {
        throw error;
      }
      result = {outcome: "sessionLost"};
    }
    if (result.outcome === "download") {
      return result.download;
    } else if (attemptsRemaining > 1) {
      await actor.attemptsTo(
        Navigate.to(currentUrl),
        ClearOsMapsObstructions.now(),
        LoginToOsMaps.withConfiguredCredentials(),
        Navigate.to(currentUrl),
        ClearOsMapsObstructions.now()
      );
      return this.captureWithSessionRecovery(actor, attemptsRemaining - 1, currentUrl);
    } else {
      throw new Error("OS Maps session was lost while waiting for the GPX download and recovery attempts were exhausted");
    }
  }

}
