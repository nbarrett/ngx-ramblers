import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { Ensure, isTrue, not, startsWith } from "@serenity-js/assertions";
import { BrowseTheWeb, Page, Scroll } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { Accept } from "../common/accept-cookie-prompt";
import {
  WALK_EDIT_SAVE_NAVIGATED,
  WALK_EDIT_SAVE_NO_SUBMIT,
  WALK_EDIT_SAVE_PENDING,
  walkEditFormSettled,
  walkEditSaveProgress
} from "../../../questions/ramblers/walk-edit-form";

const debugLog = debug(envConfig.logNamespace("SaveAndContinue"));
debugLog.enabled = true;

const CLICK_ATTEMPTS = 3;
const NAVIGATION_TIMEOUT = Duration.ofMinutes(3);
const PAGE_READY_TIMEOUT = Duration.ofMinutes(1);

export class SaveAndContinue extends Task {

  static awayFromPath(pathFragment: string): SaveAndContinue {
    return new SaveAndContinue(pathFragment);
  }

  constructor(private readonly pathFragment: string) {
    super(`#actor saves the current step and waits to navigate away from ${pathFragment}`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    await actor.attemptsTo(Wait.upTo(PAGE_READY_TIMEOUT).until(walkEditFormSettled(), isTrue()));
    await this.clickUntilNavigated(actor, 1);
    await actor.attemptsTo(Accept.dismissCookieBanners());
  }

  private async clickUntilNavigated(actor: PerformsActivities & UsesAbilities & AnswersQuestions, attempt: number): Promise<void> {
    debugLog(`clicking Save and continue, attempt ${attempt}/${CLICK_ATTEMPTS}`);
    await this.armSubmitDetection(actor);
    await actor.attemptsTo(
      Scroll.to(WalksPageElements.saveAndContinueButton),
      ClickWhenReady.on(WalksPageElements.saveAndContinueButton));
    const progress = walkEditSaveProgress(this.pathFragment);
    await actor.attemptsTo(Wait.upTo(NAVIGATION_TIMEOUT).until(progress, not(startsWith(WALK_EDIT_SAVE_PENDING))));
    const outcome: string = await actor.answer(progress);
    if (outcome.startsWith(WALK_EDIT_SAVE_NO_SUBMIT)) {
      debugLog(`attempt ${attempt}: ${outcome}`);
      if (attempt >= CLICK_ATTEMPTS) {
        throw new Error(`Save and continue click did not submit the form after ${CLICK_ATTEMPTS} attempts on ${this.pathFragment}`);
      }
      return this.clickUntilNavigated(actor, attempt + 1);
    }
    debugLog(`attempt ${attempt}: ${outcome}`);
    await actor.attemptsTo(Ensure.that(progress, startsWith(WALK_EDIT_SAVE_NAVIGATED)));
  }

  private async armSubmitDetection(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const page: Page = await BrowseTheWeb.as(actor).currentPage();
    await page.executeScript(() => {
      const globalWindow = window as unknown as {ngxSaveSubmitted?: boolean};
      globalWindow.ngxSaveSubmitted = false;
      Array.from(document.forms).forEach(form => form.addEventListener("submit", () => {
        globalWindow.ngxSaveSubmitted = true;
      }));
    });
  }
}
