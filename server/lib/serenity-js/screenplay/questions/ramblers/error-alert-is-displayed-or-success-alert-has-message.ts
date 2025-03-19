import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { ErrorAlert } from "./error-alert";
import { TextThatMightNotYetBeThere } from "../common/text-that-might-not-be-there-yet";
import { WalksPageElements } from "../../ui/ramblers/walks-page-elements";

export class ErrorAlertIsDisplayedOrSuccessAlertHasMessage extends Question<Promise<boolean>> {

  static including = (message: string) => new ErrorAlertIsDisplayedOrSuccessAlertHasMessage(message);

  constructor(private message: string) {
    super(`Success alert message message includes ${message} or error alert is displayed`);
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<boolean> {
    const displayed = await actor.answer(ErrorAlert.displayed());
    if (displayed) {
      return true;
    } else {
      return (await TextThatMightNotYetBeThere.of(WalksPageElements.successAlert).answeredBy(actor)).includes(this.message);
    }
  }
}
