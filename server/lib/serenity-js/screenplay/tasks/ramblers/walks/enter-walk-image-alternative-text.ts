import { AnswersQuestions, Duration, Interaction, PerformsActivities, UsesAbilities, Wait } from "@serenity-js/core";
import { equals, not } from "@serenity-js/assertions";
import { Enter, isVisible, Scroll, Value } from "@serenity-js/web";
import { WalkImageUpload } from "../../../../../models/walk-upload-metadata";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";

export class EnterWalkImageAlternativeText extends Interaction {

  static for(images: WalkImageUpload[]): EnterWalkImageAlternativeText {
    return new EnterWalkImageAlternativeText(images);
  }

  constructor(private readonly images: WalkImageUpload[]) {
    super("#actor enters alternative text for the uploaded walk images");
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const fields = await actor.answer(WalksPageElements.walkImageAlternativeTextFields);

    if (fields.length !== this.images.length) {
      throw new Error(`Expected ${this.images.length} walk image alternative text fields but found ${fields.length}`);
    }

    for (const [index, image] of this.images.entries()) {
      const currentField = WalksPageElements.walkImageAlternativeTextField(index);
      await actor.attemptsTo(
        Scroll.to(currentField),
        Enter.theValue(image.alternativeText).into(currentField),
        Wait.for(Duration.ofSeconds(1)),
        Wait.until(WalksPageElements.walkImagesUploadProgress, not(isVisible())),
        Scroll.to(WalksPageElements.walkImageAlternativeTextField(index)),
        Enter.theValue(image.alternativeText).into(WalksPageElements.walkImageAlternativeTextField(index)),
        Wait.for(Duration.ofSeconds(1)),
        Wait.until(WalksPageElements.walkImagesUploadProgress, not(isVisible()))
      );
      for (const [enteredIndex, enteredImage] of this.images.slice(0, index + 1).entries()) {
        await actor.attemptsTo(
          Wait.until(Value.of(WalksPageElements.walkImageAlternativeTextField(enteredIndex)), equals(enteredImage.alternativeText))
        );
      }
    }
  }
}
