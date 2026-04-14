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
    const loggedInWalksManagerPageDisplayed = await actor.answer(Visibility.of(WalksPageElements.loggedInWalksManagerPage));
    if (authErrorMessageDisplayed) {
      debugLog("Auth error message is displayed");
      return true;
    } else if (cookieBannerContainerDisplayed) {
      debugLog("Cookie Banner Container is displayed");
      return true;
    } else if (loggedInWalksManagerPageDisplayed) {
      debugLog("Logged in walks manager page is displayed");
      return true;
    } else {
      const createMenuVisible = await actor.answer(Visibility.of(WalksPageElements.createMenuDropdown));
      debugLog("Create menu dropdown is visible:", createMenuVisible);
      return createMenuVisible;
    }
  }
}
