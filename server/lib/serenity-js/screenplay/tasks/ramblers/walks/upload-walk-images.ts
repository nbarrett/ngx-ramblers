import { equals, not } from "@serenity-js/assertions";
import { Duration, Task, Wait } from "@serenity-js/core";
import { isVisible, Scroll } from "@serenity-js/web";
import { WalkImageUpload } from "../../../../../models/walk-upload-metadata";
import { ClickWhenReady } from "../../common/click-when-ready";
import { SetFileInput } from "../../common/set-file-input";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { EnterWalkImageAlternativeText } from "./enter-walk-image-alternative-text";
import { RemoveExistingWalkImages } from "./remove-existing-walk-images";
import { Accept } from "../common/accept-cookie-prompt";

export class UploadWalkImages {

  static from(images: WalkImageUpload[]) {
    const filePaths = images.map(image => image.filePath);

    return Task.where(`#actor uploads ${images.length} walk images`,
      Accept.dismissCookieBanners(),
      RemoveExistingWalkImages.beforeUpload(),
      SetFileInput.to(filePaths).from(WalksPageElements.walkImagesFileInput),
      Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImageAlternativeTextFields.count(), equals(images.length)),
      Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImageManagedRows.count(), equals(images.length)),
      Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.walkImagesUploadProgress, not(isVisible())),
      Wait.for(Duration.ofSeconds(3)),
      Wait.until(WalksPageElements.walkImageManagedRows.count(), equals(images.length)),
      Wait.until(WalksPageElements.walkImagesUploadProgress, not(isVisible())),
      EnterWalkImageAlternativeText.for(images),
      Accept.dismissCookieBanners(),
      Scroll.to(WalksPageElements.saveAndContinueButton),
      ClickWhenReady.on(WalksPageElements.saveAndContinueButton));
  }
}
