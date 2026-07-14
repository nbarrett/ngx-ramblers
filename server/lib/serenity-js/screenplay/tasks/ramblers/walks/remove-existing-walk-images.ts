import { equals, not } from "@serenity-js/assertions";
import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { isVisible } from "@serenity-js/web";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";

export class RemoveExistingWalkImages extends Task {

  static beforeUpload(): RemoveExistingWalkImages {
    return new RemoveExistingWalkImages();
  }

  constructor() {
    super("#actor removes existing walk images before uploading replacements");
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const existingButtons = await actor.answer(WalksPageElements.walkImageRemoveButtons);
    const expectedCounts = existingButtons.map((button, index) => existingButtons.length - index - 1);

    for (const expectedCount of expectedCounts) {
      const currentButtons = await actor.answer(WalksPageElements.walkImageRemoveButtons);
      await currentButtons[0].click();
      await actor.attemptsTo(
        Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImageRemoveButtons.count(), equals(expectedCount)),
        Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImagesUploadProgress, not(isVisible()))
      );
    }
  }
}
