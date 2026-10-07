import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import { isError } from "es-toolkit/compat";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";
import { dateTimeNowAsValue } from "../../../../shared/dates";
import { WalkEditSaveAction } from "../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

const debugLog = debug(envConfig.logNamespace("WalkEditForm"));
debugLog.enabled = true;

export const WALK_EDIT_SAVE_PENDING = "pending";
export const WALK_EDIT_SAVE_NAVIGATED = "navigated";
export const WALK_EDIT_SAVE_NO_SUBMIT = "no-submit";
export const WALK_EDIT_WIZARD_URL_FRAGMENT = "/walks-manager/walk/";

export function walkEditPageNavigatedDuringScript(error: unknown): boolean {
  const message = isError(error) ? error.message : String(error);
  return message.includes("Execution context was destroyed") || message.includes("Target closed");
}

export function walkEditFormExpired(error: unknown): boolean {
  const message = isError(error) ? error.message : String(error);
  return message.includes("form was open for too long");
}

export function walkEditDrupalErrorText(documentRef: Document): string | null {
  const errorElement = documentRef.querySelector("[data-drupal-message-type='error'], [aria-label='Error message'], .alert.alert-danger");
  const text = errorElement ? (errorElement.textContent || "").replace(/\s+/g, " ").trim() : "";
  return text || null;
}

const SUBMIT_DETECTION_WINDOW_MILLIS = 5 * 1000;

interface WalkEditFormSettledState {
  documentComplete: boolean;
  behavioursAttached: boolean;
  ajaxInFlight: boolean;
}

export function walkEditFormSettled(): Question<Promise<boolean>> {
  return Question.about("the walk edit form has settled", async (actor: AnswersQuestions & UsesAbilities) => {
    const page = await BrowseTheWeb.as(actor).currentPage();
    const state = await page.executeScript(() => {
      const button = document.querySelector("input[value='Save and continue']");
      return {
        documentComplete: document.readyState === "complete",
        behavioursAttached: !!button && button.classList.contains("node-edit-protection-processed"),
        ajaxInFlight: !!document.querySelector(".ajax-progress, .ajax-progress-throbber")
      };
    }) as WalkEditFormSettledState;
    debugLog("form settled state:", JSON.stringify(state));
    return state.documentComplete && state.behavioursAttached && !state.ajaxInFlight;
  });
}

interface WalkEditSavePageState {
  submitted: boolean;
  errorMessage: string | null;
}

export function walkEditSaveProgress(pathFragment: string, saveAction: WalkEditSaveAction = WalkEditSaveAction.CONTINUE): Question<Promise<string>> {
  const progress = {firstAskedAt: 0, terminalAnswer: ""};
  return Question.about(`the walk edit save progress away from ${pathFragment}`, async (actor: AnswersQuestions & UsesAbilities) => {
    if (progress.terminalAnswer) {
      return progress.terminalAnswer;
    } else {
      progress.firstAskedAt = progress.firstAskedAt || dateTimeNowAsValue();
      const page = await BrowseTheWeb.as(actor).currentPage();
      const currentUrl: string = (await page.url()).toString();
      const leftStep = !currentUrl.includes(pathFragment);
      const stillInWizard = currentUrl.includes(WALK_EDIT_WIZARD_URL_FRAGMENT);
      if (leftStep && (saveAction === WalkEditSaveAction.PUBLISH || stillInWizard)) {
        progress.terminalAnswer = `${WALK_EDIT_SAVE_NAVIGATED} to ${currentUrl}`;
        return progress.terminalAnswer;
      } else {
        const state = {submitted: false, errorMessage: null as string | null, available: false};
        try {
          const pageState = await page.executeScript(() => {
            const errorElement = document.querySelector("[data-drupal-message-type='error'], [aria-label='Error message'], .alert.alert-danger");
            const text = errorElement ? (errorElement.textContent || "").replace(/\s+/g, " ").trim() : "";
            const globalWindow = window as unknown as {ngxSaveSubmitted?: boolean};
            return {
              submitted: globalWindow.ngxSaveSubmitted === true,
              errorMessage: text || null
            };
          }) as WalkEditSavePageState;
          state.submitted = pageState.submitted;
          state.errorMessage = pageState.errorMessage;
          state.available = true;
        } catch (error) {
          if (!walkEditPageNavigatedDuringScript(error)) {
            throw error;
          }
        }
        if (!state.available) {
          return `${WALK_EDIT_SAVE_PENDING}: page navigated while reading save progress`;
        } else if (leftStep) {
          progress.terminalAnswer = `Walks Manager error: ${state.errorMessage || `left the walk editor unexpectedly at ${currentUrl}`}`;
          return progress.terminalAnswer;
        } else if (state.errorMessage) {
          progress.terminalAnswer = `Walks Manager error: ${state.errorMessage}`;
          return progress.terminalAnswer;
        } else {
          const elapsedMillis = dateTimeNowAsValue() - progress.firstAskedAt;
          if (!state.submitted && elapsedMillis >= SUBMIT_DETECTION_WINDOW_MILLIS) {
            progress.terminalAnswer = `${WALK_EDIT_SAVE_NO_SUBMIT}: click fired no form submit within ${SUBMIT_DETECTION_WINDOW_MILLIS / 1000}s`;
            return progress.terminalAnswer;
          } else {
            return state.submitted
              ? `${WALK_EDIT_SAVE_PENDING}: submitted, still on ${currentUrl}`
              : `${WALK_EDIT_SAVE_PENDING}: awaiting form submit, ${elapsedMillis}ms elapsed`;
          }
        }
      }
    }
  });
}
