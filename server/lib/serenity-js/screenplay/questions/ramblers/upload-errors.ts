import { AnswersQuestions, MetaQuestion, PerformsActivities, Question, UsesAbilities } from "@serenity-js/core";
import { WalksPageElements } from "../../ui/ramblers/walks-page-elements";
import { UploadError } from "./upload-error";
import { PageElement, Text } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("parse-upload-errors"));
debugLog.enabled = false;

export class UploadErrors extends Question<Promise<UploadError[]>> {
  static displayed = () => new UploadErrors(`upload errors`);

  async answeredBy(actor: PerformsActivities & AnswersQuestions & UsesAbilities): Promise<UploadError[]> {
    return actor.answer(WalksPageElements.uploadErrorListItems.eachMappedTo(UploadErrorDetails));
  }
}

const UploadErrorDetails: MetaQuestion<PageElement, Question<Promise<UploadError>>> = {

  of: (listItem: PageElement) =>
    Question.about("upload error", async actor => {
      const rows = await actor.answer(Text.of(WalksPageElements.emphasisedWithin(listItem)));
      const allText = await actor.answer(Text.of(listItem));
      const message = allText.replace(rows, "").replace("\n", "");
      const response = {
        rows,
        message,
      };
      debugLog("UploadErrorDetails contains:", response);
      return response;
    })
};

