import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { isTrue, not, startsWith } from "@serenity-js/assertions";
import { BrowseTheWeb, Page, Scroll } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { Accept } from "../common/accept-cookie-prompt";
import { PublishWalkEditForm } from "./publish-walk-edit-form";
import {
  WALK_EDIT_SAVE_NAVIGATED,
  WALK_EDIT_SAVE_NO_SUBMIT,
  WALK_EDIT_SAVE_PENDING,
  walkEditFormSettled,
  walkEditSaveProgress
} from "../../../questions/ramblers/walk-edit-form";
import { WalkEditSaveAction } from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

const debugLog = debug(envConfig.logNamespace("SaveAndContinue"));
debugLog.enabled = true;

const CLICK_ATTEMPTS = 3;
const NAVIGATION_TIMEOUT = Duration.ofMinutes(3);
const PAGE_READY_TIMEOUT = Duration.ofMinutes(1);

export class SaveAndContinue extends Task {

  static awayFromPath(pathFragment: string): SaveAndContinue {
    return new SaveAndContinue(pathFragment, WalkEditSaveAction.CONTINUE);
  }

  static byPublishingAwayFromPath(pathFragment: string): SaveAndContinue {
    return new SaveAndContinue(pathFragment, WalkEditSaveAction.PUBLISH);
  }

  constructor(private readonly pathFragment: string, private readonly saveAction: WalkEditSaveAction = WalkEditSaveAction.CONTINUE) {
    super(saveAction === WalkEditSaveAction.PUBLISH
      ? `#actor publishes the walk and waits to navigate away from ${pathFragment}`
      : `#actor saves the current step and waits to navigate away from ${pathFragment}`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    await actor.attemptsTo(Wait.upTo(PAGE_READY_TIMEOUT).until(walkEditFormSettled(), isTrue()));
    await this.clickUntilNavigated(actor, 1);
    await actor.attemptsTo(Accept.dismissCookieBanners());
  }

  private async clickUntilNavigated(actor: PerformsActivities & UsesAbilities & AnswersQuestions, attempt: number): Promise<void> {
    debugLog(`clicking ${this.saveAction} save, attempt ${attempt}/${CLICK_ATTEMPTS}`);
    await this.armSubmitDetection(actor);
    await this.submitWalkEdit(actor);
    const progress = walkEditSaveProgress(this.pathFragment, this.saveAction);
    await actor.attemptsTo(Wait.upTo(NAVIGATION_TIMEOUT).until(progress, not(startsWith(WALK_EDIT_SAVE_PENDING))));
    const outcome: string = await actor.answer(progress);
    if (outcome.startsWith(WALK_EDIT_SAVE_NO_SUBMIT)) {
      debugLog(`attempt ${attempt}: ${outcome}`);
      if (attempt >= CLICK_ATTEMPTS) {
        throw new Error(`${this.saveAction === WalkEditSaveAction.PUBLISH ? "Publish" : "Save and continue"} did not submit the form after ${CLICK_ATTEMPTS} attempts on ${this.pathFragment}`);
      } else {
        await this.clickUntilNavigated(actor, attempt + 1);
      }
    } else if (outcome.startsWith(WALK_EDIT_SAVE_NAVIGATED)) {
      debugLog(`attempt ${attempt}: ${outcome}`);
    } else {
      throw new Error(outcome);
    }
  }

  private async submitWalkEdit(actor: PerformsActivities): Promise<void> {
    if (this.saveAction === WalkEditSaveAction.PUBLISH) {
      await actor.attemptsTo(PublishWalkEditForm.now());
    } else {
      await actor.attemptsTo(
        Scroll.to(WalksPageElements.saveAndContinueButton),
        ClickWhenReady.on(WalksPageElements.saveAndContinueButton));
    }
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
