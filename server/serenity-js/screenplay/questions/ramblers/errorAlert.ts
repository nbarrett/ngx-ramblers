import { AnswersQuestions, Question, UsesAbilities } from "@serenity-js/core";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { WalksTargets } from "../../ui/ramblers/walksTargets";

export class ErrorAlert implements Question<Promise<boolean>> {

  static displayed = () => new ErrorAlert();

  toString() {
    return "Error Alert is showing";
  }

  answeredBy(actor: AnswersQuestions & UsesAbilities): Promise<boolean> {
    return promiseOf(WalksTargets.errorAlert.answeredBy(actor).isPresent());
  }

}
