import { AnswersQuestions, MetaQuestion, PerformsActivities, Question, UsesAbilities } from "@serenity-js/core";
import { WalksTargets } from "../../ui/ramblers/walksTargets";
import { UploadError } from "./uploadError";
import { PageElement, Text } from "@serenity-js/web";

export class UploadErrors extends Question<Promise<UploadError[]>> {
  static displayed = () => new UploadErrors(`upload errors`);

  async answeredBy(actor: PerformsActivities & AnswersQuestions & UsesAbilities): Promise<UploadError[]> {
    return actor.answer(WalksTargets.uploadErrorListItems.eachMappedTo(UploadErrorDetails));
  }
}

const UploadErrorDetails: MetaQuestion<PageElement, Question<Promise<UploadError>>> = {

  of: (listItem: PageElement) =>
    Question.about("upload error", async actor => {
      const rows = await actor.answer(Text.of(WalksTargets.emphasisedWithin(listItem)));
      const allText = await actor.answer(Text.of(listItem));
      const message = allText.replace(rows, "");
      return {
        rows,
        message,
      };
    })
};

//
//  <div aria-label="Error message" class="alert alert-error alert-danger alert-dismissible fade show mb-0 mt-3" role="alert">
//     <h2 class="visually-hidden">Error message</h2>
//     <div class="item-list"><h3>Validation errors on 3 rows</h3>
//         <ul>
//             <li>Walk leader Invalid User 1 not found<br><em>Row: 2</em></li>
//             <li>Walk leader Invalid User 2 not found<br><em>Row: 3</em></li>
//             <li>Linear or Circular must be one of: Circular, Linear<br><em>Row: 4</em></li>
//         </ul>
//     </div>
// </div>
