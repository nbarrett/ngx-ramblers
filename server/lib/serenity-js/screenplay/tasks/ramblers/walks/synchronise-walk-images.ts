import { equals, isPresent, not } from "@serenity-js/assertions";
import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { Attribute, Enter, isVisible, PageElement, Scroll, Value } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { ExistingWalkImage, WalkImageDelta, WalkImageUpload } from "../../../../../models/walk-upload-metadata";
import { calculateWalkImageDelta, imageIdentity, normalisedAlternativeText } from "../../../../../ramblers/walk-image-delta";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { SetFileInput } from "../../common/set-file-input";
import { Accept } from "../common/accept-cookie-prompt";
import { EnterWalkImageAlternativeText } from "./enter-walk-image-alternative-text";
import { UploadWalkImages } from "./upload-walk-images";
import { SelectOptionViaScript } from "./select-option-via-script";
import { AwaitWalkImageRows } from "./await-walk-image-rows";

const debugLog = debug(envConfig.logNamespace("SynchroniseWalkImages"));
debugLog.enabled = true;

export class SynchroniseWalkImages extends Task {

  static to(images: WalkImageUpload[]): SynchroniseWalkImages {
    return new SynchroniseWalkImages(images);
  }

  constructor(private readonly images: WalkImageUpload[]) {
    super(`#actor synchronises ${images.length} walk images`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    await actor.attemptsTo(Accept.dismissCookieBanners());
    const existingImages: ExistingWalkImage[] = await existingWalkImages(actor);
    const delta: WalkImageDelta = calculateWalkImageDelta(existingImages, this.images);
    debugLog("existing images:", existingImages.map(image => image.fileName),
      "desired images:", this.images.map(image => image.fileName),
      "delta:", delta);

    if (this.images.length > 0 && (delta.fullReplace || existingImages.length === 0)) {
      debugLog("uploading all", this.images.length, "walk images");
      await actor.attemptsTo(UploadWalkImages.from(this.images));
      return;
    }

    await this.removeImages(actor, delta, existingImages.length);
    await this.addImages(actor, delta);
    await this.enterAlternativeText(actor);
    await this.applyDisplayOrder(actor, delta);

    await actor.attemptsTo(
      AwaitWalkImageRows.toNumber(this.images.length),
      Accept.dismissCookieBanners());
  }

  private async removeImages(actor: PerformsActivities & UsesAbilities & AnswersQuestions, delta: WalkImageDelta, existingCount: number): Promise<void> {
    const removalIndexes = [...delta.removalIndexes].sort((first, second) => second - first);
    if (removalIndexes.length === 0) {
      debugLog("no walk images to remove");
      return;
    }
    await removalIndexes.reduce(async (previousRemovals: Promise<void>, removalIndex: number, position: number) => {
      await previousRemovals;
      const rows: PageElement[] = await actor.answer(WalksPageElements.walkImageManagedRows);
      const expectedCount = existingCount - position - 1;
      debugLog("removing walk image at index", removalIndex, "leaving", expectedCount, "images");
      await actor.attemptsTo(
        Scroll.to(WalksPageElements.walkImageRowRemoveButton(rows[removalIndex])),
        ClickWhenReady.on(WalksPageElements.walkImageRowRemoveButton(rows[removalIndex])),
        AwaitWalkImageRows.toNumber(expectedCount));
    }, Promise.resolve());
  }

  private async addImages(actor: PerformsActivities & UsesAbilities & AnswersQuestions, delta: WalkImageDelta): Promise<void> {
    if (delta.additions.length === 0) {
      debugLog("no new walk images to upload");
      return;
    }
    debugLog("uploading", delta.additions.length, "new walk images:", delta.additions.map(image => image.fileName));
    await actor.attemptsTo(
      Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImagesFileInput, isPresent()),
      SetFileInput.to(delta.additions.map(image => image.filePath)).from(WalksPageElements.walkImagesFileInput),
      AwaitWalkImageRows.toNumber(this.images.length));
  }

  private async enterAlternativeText(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const currentImages: ExistingWalkImage[] = await existingWalkImages(actor);
    if (currentImages.length !== this.images.length) {
      throw new Error(`Expected ${this.images.length} walk images after synchronisation but found ${currentImages.length}`);
    }
    const rowsInDesiredOrder = currentImages.every((currentImage, index) => imageIdentity(currentImage.fileName) === imageIdentity(this.images[index].fileName));
    if (rowsInDesiredOrder) {
      await actor.attemptsTo(EnterWalkImageAlternativeText.for(this.images));
      return;
    }
    await currentImages.reduce(async (previousEntries: Promise<void>, currentImage: ExistingWalkImage, index: number) => {
      await previousEntries;
      const desiredImage: WalkImageUpload = this.desiredImageFor(currentImage, index);
      if (normalisedAlternativeText(currentImage.alternativeText) === normalisedAlternativeText(desiredImage.alternativeText)) {
        debugLog("alternative text already correct for", currentImage.fileName);
        return;
      }
      debugLog("entering alternative text", desiredImage.alternativeText, "for", currentImage.fileName);
      const rows: PageElement[] = await actor.answer(WalksPageElements.walkImageManagedRows);
      const alternativeTextField = WalksPageElements.walkImageRowAlternativeTextField(rows[index]);
      await actor.attemptsTo(
        Scroll.to(alternativeTextField),
        Enter.theValue(desiredImage.alternativeText).into(alternativeTextField),
        Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImagesUploadProgress, not(isVisible())),
        Wait.until(Value.of(alternativeTextField), equals(desiredImage.alternativeText)));
    }, Promise.resolve());
  }

  private async applyDisplayOrder(actor: PerformsActivities & UsesAbilities & AnswersQuestions, delta: WalkImageDelta): Promise<void> {
    if (!delta.reorderRequired) {
      debugLog("walk images are already in the order held on the group website");
      return;
    }
    const currentImages: ExistingWalkImage[] = await existingWalkImages(actor);
    await currentImages.reduce(async (previousOrdering: Promise<void>, currentImage: ExistingWalkImage, index: number) => {
      await previousOrdering;
      const desiredPosition = this.images.findIndex(image => imageIdentity(image.fileName) === imageIdentity(currentImage.fileName));
      const position = desiredPosition < 0 ? index : desiredPosition;
      debugLog("setting display order of", currentImage.fileName, "to", position);
      await actor.attemptsTo(
        SelectOptionViaScript.on(`select[name="field_walk_image[${index}][_weight]"]`, `sets image ${index + 1} display order to ${position + 1}`).toValue(`${position}`));
    }, Promise.resolve());
  }

  private desiredImageFor(currentImage: ExistingWalkImage, index: number): WalkImageUpload {
    return this.images.find(image => imageIdentity(image.fileName) === imageIdentity(currentImage.fileName)) || this.images[index];
  }
}

async function existingWalkImages(actor: AnswersQuestions & UsesAbilities): Promise<ExistingWalkImage[]> {
  const rows: PageElement[] = await actor.answer(WalksPageElements.walkImageManagedRows);
  return rows.reduce(async (previousImages: Promise<ExistingWalkImage[]>, row: PageElement) => {
    const images = await previousImages;
    const fileLink = await actor.answer(Attribute.called("href").of(WalksPageElements.walkImageRowLink(row)));
    const alternativeText = await actor.answer(Value.of(WalksPageElements.walkImageRowAlternativeTextField(row)));
    return images.concat({fileName: fileLink, alternativeText});
  }, Promise.resolve([]));
}
