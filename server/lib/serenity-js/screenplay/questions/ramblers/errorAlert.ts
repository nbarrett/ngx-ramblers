import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { WalksTargets } from "../../ui/ramblers/walksTargets";

export class ErrorAlert extends Question<Promise<boolean>> {

  static displayed = () => new ErrorAlert("Error Alert is showing");


  answeredBy(actor: AnswersQuestions & UsesAbilities): Promise<boolean> {
    return WalksTargets.errorAlert.answeredBy(actor).then(item => item.isVisible());
  }

}
