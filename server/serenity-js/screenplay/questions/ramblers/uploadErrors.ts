import { AnswersQuestions, PerformsActivities, Question, UsesAbilities } from "@serenity-js/core";
import { promiseOf } from "@serenity-js/protractor/lib/promiseOf";
import { by, ElementFinder } from "protractor";
import { WalksTargets } from "../../ui/ramblers/walksTargets";
import { UploadError } from "./uploadError";

export class UploadErrors implements Question<Promise<UploadError[]>> {

  static displayed = () => new UploadErrors();

  answeredBy(actor: PerformsActivities & AnswersQuestions & UsesAbilities): Promise<UploadError[]> {
    return promiseOf(WalksTargets.uploadErrorList.answeredBy(actor)
      .map((element: ElementFinder) => {
        return element.element(by.tagName("em")).getText().then((rows: string) => {
          return element.getText().then(allText => {
            const message = allText.replace(rows, "");
            return {
              rows,
              message,
            };
          });
        });
      })) as Promise<UploadError[]>;
  }

  toString = () => `upload errors`;

}
