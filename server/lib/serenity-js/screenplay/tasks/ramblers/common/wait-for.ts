import { Ensure, equals, includes, not } from "@serenity-js/assertions";
import { Task, Wait } from "@serenity-js/core";
import { SelectedWalksHaveCount } from "../../../questions/ramblers/selected-walks-have-count";
import { SelectedWalksWithStatus } from "../../../questions/ramblers/selected-walks-with-status";
import { WalksHaveCount } from "../../../questions/ramblers/walks-have-count";
import { WalksHaveCountOrErrorDisplayed } from "../../../questions/ramblers/walks-have-count-or-error-displayed";
import { WalksWithStatus } from "../../../questions/ramblers/walks-have-status";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { isVisible, Text } from "@serenity-js/web";
import { TextThatMightNotYetBeThere } from "../../../questions/common/text-that-might-not-be-there-yet";

export class WaitFor {

  static ramblersToFinishProcessing() {
    return Task.where(`#actor waits for processing to complete`,
      Wait.until(WalksPageElements.progressIndicator, not(isVisible())));
  }

  static successAlertToEventuallyContain(message: string) {
    return Task.where(`#actor waits for the success alert to contain message '${message}'`,
      Wait.until(TextThatMightNotYetBeThere.of(WalksPageElements.successAlert), includes(message)));
  }

  static successAlertToNotContainMessage(message: string) {
    return Task.where(`#actor waits for the success alert to contain message '${message}'`,
      Wait.until(TextThatMightNotYetBeThere.of(WalksPageElements.successAlert), not(includes(message))));
  }

  static ramblersToFinishProcessingEventually() {
    return Task.where(`#actor waits for processing to complete`,
      Ensure.eventually(WalksPageElements.progressIndicator, not(isVisible())));
  }

  static successAlertToContainMessageEventuallyFailsCurrently(message: string) {
    return Task.where(`#actor waits for the success alert to eventually contain message '${message}'`,
      Ensure.eventually(Text.of(WalksPageElements.alertMessage), includes(message)));
  }

  static selectedWalksToReachStatus(...statuses: string[]) {
    return Wait.until(WalksWithStatus.matching(...statuses), equals(true));
  }

  static noSelectedWalksToHaveStatus(...statuses: string[]) {
    return Wait.until(SelectedWalksWithStatus.notMatching(...statuses), equals(true));
  }

  static errorOrCountOfWalksToBe(walkCount: number) {
    return Wait.until(WalksHaveCountOrErrorDisplayed.matching(walkCount), equals(true));
  }

  static countOfSelectedWalksToBe(walkCount: number) {
    return Wait.until(SelectedWalksHaveCount.matching(walkCount), equals(true));
  }

  static countOfWalksToBe(walkCount: number) {
    return Wait.until(WalksHaveCount.matching(walkCount), equals(true));
  }
}
