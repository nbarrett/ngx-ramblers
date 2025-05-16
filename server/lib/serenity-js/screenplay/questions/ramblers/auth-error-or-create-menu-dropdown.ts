import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { WalksPageElements } from "../../ui/ramblers/walks-page-elements";
import { Visibility } from "../common/visibility";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("AuthErrorOrCreateMenuDropdown"));
debugLog.enabled = false;

export class AuthErrorOrCreateMenuDropdown extends Question<Promise<boolean>> {

  static isDisplayed = () => new AuthErrorOrCreateMenuDropdown();

  constructor() {
    super(`Auth error or create menu dropdown is displayed`);
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    const authErrorMessageDisplayed = await actor.answer(Visibility.of(WalksPageElements.authErrorMessage));
    if (authErrorMessageDisplayed) {
      debugLog("Auth error message is displayed");
      return true;
    } else {
      const createMenuVisible = await actor.answer(Visibility.of(WalksPageElements.createMenuDropdown));
      debugLog("Create menu dropdown is visible:", createMenuVisible);
      return createMenuVisible;
    }
  }
}
