import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { WalksPageElements } from "../../ui/ramblers/walks-page-elements";
import { Visibility } from "../common/visibility";

export class ErrorAlert extends Question<Promise<boolean>> {

  static displayed = () => new ErrorAlert("Error Alert is showing");


  answeredBy(actor: AnswersQuestions & UsesAbilities): Promise<boolean> {
    return actor.answer(Visibility.of(WalksPageElements.errorAlert));
  }

}
