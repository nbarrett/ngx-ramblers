import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";

export class OsMapsLoadingIndicatorDisplayed extends Question<Promise<boolean>> {

  static now = () => new OsMapsLoadingIndicatorDisplayed();

  constructor() {
    super("OS Maps header or side panel loading indicator is displayed");
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    const headerLoadingIndicatorDisplayed = await actor.answer(OsMapsPageElements.headerLoadingIndicator).then(element => element.isVisible());
    if (headerLoadingIndicatorDisplayed) {
      return true;
    } else {
      return actor.answer(OsMapsPageElements.sidePanelLoadingIndicator).then(element => element.isVisible());
    }
  }

}
