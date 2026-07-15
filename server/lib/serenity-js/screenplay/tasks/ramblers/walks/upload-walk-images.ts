import { Task } from "@serenity-js/core";
import { WalkImageUpload } from "../../../../../models/walk-upload-metadata";
import { SetFileInput } from "../../common/set-file-input";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { EnterWalkImageAlternativeText } from "./enter-walk-image-alternative-text";
import { RemoveExistingWalkImages } from "./remove-existing-walk-images";
import { Accept } from "../common/accept-cookie-prompt";
import { AwaitWalkImageRows } from "./await-walk-image-rows";

export class UploadWalkImages {

  static from(images: WalkImageUpload[]) {
    const filePaths = images.map(image => image.filePath);

    return Task.where(`#actor uploads ${images.length} walk images`,
      Accept.dismissCookieBanners(),
      RemoveExistingWalkImages.beforeUpload(),
      SetFileInput.to(filePaths).from(WalksPageElements.walkImagesFileInput),
      AwaitWalkImageRows.toNumber(images.length),
      EnterWalkImageAlternativeText.for(images),
      Accept.dismissCookieBanners());
  }
}
