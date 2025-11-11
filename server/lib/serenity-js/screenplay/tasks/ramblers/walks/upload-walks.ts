import { Task, Wait } from "@serenity-js/core";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { Enter } from "@serenity-js/web";
import { pluralise, pluraliseWithCount } from "../../../../../shared/string-utils";
import { ClickWhenReady } from "../../common/click-when-ready";
import { Log } from "../common/log";
import {
  ErrorAlertIsDisplayedOrSuccessAlertHasMessage
} from "../../../questions/ramblers/error-alert-is-displayed-or-success-alert-has-message";
import { equals } from "@serenity-js/assertions";
import { Accept } from "../common/accept-cookie-prompt";

export class UploadWalks {

  static fileWithNameAndCount(fileName: string, walkCount: number) {
    return UploadWalksSpecifiedWalks.withFile(fileName, walkCount);
  }

  static requested() {
    const walkParameters = RequestParameterExtractor.extract();
    return UploadWalksSpecifiedWalks.withFile(walkParameters.fileName, walkParameters.walkCount);
  }

}

export class UploadWalksSpecifiedWalks {

  static withFile(fileName: string, walkCount: number) {
    const message = `${pluraliseWithCount(walkCount, "walk")} ${pluralise(walkCount, "has", "have")} been created`;
    return Task.where(`#actor uploads file ${fileName} containing ${pluraliseWithCount(walkCount, "walk")}`,
      Log.message(`Uploading file ${fileName} containing ${pluraliseWithCount(walkCount, "walk")}`),
      ClickWhenReady.on(WalksPageElements.createMenuDropdown),
      ClickWhenReady.on(WalksPageElements.uploadAWalksCSV),
      Accept.forceDismissCookieBanners(),
      Accept.cookieBannerIfVisible(),
      Enter.theValue(fileName).into(WalksPageElements.chooseFilesButton),
      Accept.forceDismissCookieBanners(),
      ClickWhenReady.on(WalksPageElements.uploadWalksButton),
      Wait.until(ErrorAlertIsDisplayedOrSuccessAlertHasMessage.including(message), equals(true)));
  }
}
