import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";

export const WALK_IMAGE_ROWS_PENDING = "pending";
export const WALK_IMAGE_ROWS_SETTLED = "settled";

const REQUIRED_STABLE_POLLS = 2;

interface WalkImageFormState {
  rowCount: number;
  uploadInProgress: boolean;
  errorMessage: string | null;
}

export function walkImageRowsStatus(expectedCount: number): Question<Promise<string>> {
  const progress = {consecutiveSettledPolls: 0, terminalAnswer: ""};
  return Question.about(`the walk image rows reaching ${expectedCount}`, async (actor: AnswersQuestions & UsesAbilities) => {
    if (progress.terminalAnswer) {
      return progress.terminalAnswer;
    }
    const page = await BrowseTheWeb.as(actor).currentPage();
    const state = await page.executeScript(() => {
      const errorElement = document.querySelector("[data-drupal-message-type='error']");
      const errorMessage = errorElement ? (errorElement.textContent || "").replace(/\s+/g, " ").trim() : null;
      const rowCount = document.querySelectorAll("input[name*='[alt]']").length;
      const uploadInProgress = !!document.querySelector(".ajax-progress, .ajax-progress-throbber");
      return {rowCount, uploadInProgress, errorMessage};
    }) as WalkImageFormState;
    if (state.errorMessage) {
      progress.terminalAnswer = `Walks Manager error: ${state.errorMessage}`;
      return progress.terminalAnswer;
    }
    const settledNow = state.rowCount === expectedCount && !state.uploadInProgress;
    progress.consecutiveSettledPolls = settledNow ? progress.consecutiveSettledPolls + 1 : 0;
    if (settledNow && progress.consecutiveSettledPolls >= REQUIRED_STABLE_POLLS) {
      progress.terminalAnswer = `${WALK_IMAGE_ROWS_SETTLED}: ${expectedCount} rows stable across ${REQUIRED_STABLE_POLLS} polls`;
      return progress.terminalAnswer;
    }
    return `${WALK_IMAGE_ROWS_PENDING}: ${state.rowCount} of ${expectedCount} rows, upload in progress: ${state.uploadInProgress}`;
  });
}
