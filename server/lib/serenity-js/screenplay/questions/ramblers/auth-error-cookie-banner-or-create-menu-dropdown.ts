import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { WalksPageElements } from "../../ui/ramblers/walks-page-elements";
import { Visibility } from "../common/visibility";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("AuthErrorCookieBannerOrCreateMenuDropdown"));
debugLog.enabled = false;

export class AuthErrorCookieBannerOrCreateMenuDropdown extends Question<Promise<boolean>> {

  static isDisplayed = () => new AuthErrorCookieBannerOrCreateMenuDropdown();

  constructor() {
    super(`Auth error, cookie banner or create menu dropdown is displayed`);
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    const authErrorMessageDisplayed = await actor.answer(Visibility.of(WalksPageElements.authErrorMessage));
    const cookieBannerContainerDisplayed = await actor.answer(Visibility.of(WalksPageElements.cookieBannerContainer));
    if (authErrorMessageDisplayed) {
      debugLog("Auth error message is displayed");
      return true;
    } else if (cookieBannerContainerDisplayed) {
      debugLog("Cookie Banner Container is displayed");
      return true;
    } else {
      const createMenuVisible = await actor.answer(Visibility.of(WalksPageElements.createMenuDropdown));
      debugLog("Create menu dropdown is visible:", createMenuVisible);
      return createMenuVisible;
    }
  }
}
