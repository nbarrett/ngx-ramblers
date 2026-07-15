import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";
import { dateTimeNowAsValue } from "../../../../shared/dates";

const debugLog = debug(envConfig.logNamespace("WalkEditForm"));
debugLog.enabled = true;

export const WALK_EDIT_SAVE_PENDING = "pending";
export const WALK_EDIT_SAVE_NAVIGATED = "navigated";
export const WALK_EDIT_SAVE_NO_SUBMIT = "no-submit";

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

export function walkEditSaveProgress(pathFragment: string): Question<Promise<string>> {
  const progress = {firstAskedAt: 0, terminalAnswer: ""};
  return Question.about(`the walk edit save progress away from ${pathFragment}`, async (actor: AnswersQuestions & UsesAbilities) => {
    if (progress.terminalAnswer) {
      return progress.terminalAnswer;
    }
    progress.firstAskedAt = progress.firstAskedAt || dateTimeNowAsValue();
    const page = await BrowseTheWeb.as(actor).currentPage();
    const currentUrl: string = (await page.url()).toString();
    if (!currentUrl.includes(pathFragment)) {
      progress.terminalAnswer = `${WALK_EDIT_SAVE_NAVIGATED} to ${currentUrl}`;
      return progress.terminalAnswer;
    }
    const state = await page.executeScript(() => {
      const globalWindow = window as unknown as {ngxSaveSubmitted?: boolean};
      const errorElement = document.querySelector("[data-drupal-message-type='error']");
      return {
        submitted: globalWindow.ngxSaveSubmitted === true,
        errorMessage: errorElement ? (errorElement.textContent || "").replace(/\s+/g, " ").trim() : null
      };
    }) as WalkEditSavePageState;
    if (state.errorMessage) {
      progress.terminalAnswer = `Walks Manager error: ${state.errorMessage}`;
      return progress.terminalAnswer;
    }
    const elapsedMillis = dateTimeNowAsValue() - progress.firstAskedAt;
    if (!state.submitted && elapsedMillis >= SUBMIT_DETECTION_WINDOW_MILLIS) {
      progress.terminalAnswer = `${WALK_EDIT_SAVE_NO_SUBMIT}: click fired no form submit within ${SUBMIT_DETECTION_WINDOW_MILLIS / 1000}s`;
      return progress.terminalAnswer;
    }
    return state.submitted
      ? `${WALK_EDIT_SAVE_PENDING}: submitted, still on ${currentUrl}`
      : `${WALK_EDIT_SAVE_PENDING}: awaiting form submit, ${elapsedMillis}ms elapsed`;
  });
}
