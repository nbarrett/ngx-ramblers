import { AnswersQuestions, Interaction, PerformsActivities, UsesAbilities, Wait } from "@serenity-js/core";
import { equals, not } from "@serenity-js/assertions";
import { Enter, isVisible, Scroll, Value } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { WalkImageUpload } from "../../../../../models/walk-upload-metadata";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";

const debugLog = debug(envConfig.logNamespace("EnterWalkImageAlternativeText"));
debugLog.enabled = true;

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

    await this.images.reduce(async (previousImage: Promise<void>, image: WalkImageUpload, index: number) => {
      await previousImage;
      await this.enterUntilHeld(actor, image, index);
      await this.verifyEarlierEntriesStillHeld(actor, index);
    }, Promise.resolve());
  }

  private async enterUntilHeld(actor: PerformsActivities & UsesAbilities & AnswersQuestions, image: WalkImageUpload, index: number): Promise<void> {
    const field = WalksPageElements.walkImageAlternativeTextField(index);
    await actor.attemptsTo(
      Scroll.to(field),
      Enter.theValue(image.alternativeText).into(field),
      Wait.until(WalksPageElements.walkImagesUploadProgress, not(isVisible())));
    const heldValue = await actor.answer(Value.of(field));
    if (heldValue !== image.alternativeText) {
      debugLog(`alternative text for image ${index + 1} was reset by a form refresh, re-entering`);
      await actor.attemptsTo(
        Enter.theValue(image.alternativeText).into(field),
        Wait.until(WalksPageElements.walkImagesUploadProgress, not(isVisible())),
        Wait.until(Value.of(field), equals(image.alternativeText)));
    }
  }

  private async verifyEarlierEntriesStillHeld(actor: PerformsActivities & UsesAbilities & AnswersQuestions, index: number): Promise<void> {
    await this.images.slice(0, index + 1).reduce(async (previousEntry: Promise<void>, enteredImage: WalkImageUpload, enteredIndex: number) => {
      await previousEntry;
      await actor.attemptsTo(
        Wait.until(Value.of(WalksPageElements.walkImageAlternativeTextField(enteredIndex)), equals(enteredImage.alternativeText)));
    }, Promise.resolve());
  }
}
