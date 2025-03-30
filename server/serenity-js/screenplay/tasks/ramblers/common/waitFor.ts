import { Check, Ensure, equals, includes, not } from "@serenity-js/assertions";
import { Duration, Task } from "@serenity-js/core";
import { isPresent, Text, Wait } from "@serenity-js/protractor";
import { SelectedWalksHaveCount } from "../../../questions/ramblers/selectedWalksHaveCount";
import { SelectedWalksWithStatus } from "../../../questions/ramblers/selectedWalksWithStatus";
import { WalksHaveCount } from "../../../questions/ramblers/walksHaveCount";
import { WalksHaveCountOrErrorDisplayed } from "../../../questions/ramblers/walksHaveCountOrErrorDisplayed";
import { WalksWithStatus } from "../../../questions/ramblers/walksHaveStatus";
import { WalksTargets } from "../../../ui/ramblers/walksTargets";
import { TextThatMightNotYetBeThere } from "../../../questions/common/text-that-might-not-be-there-yet";

const TIMEOUT_IN_SECONDS = 20;
export class WaitFor {

  static ramblersToFinishProcessing() {
    return Task.where(`#actor waits for processing to complete`,
        Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(WalksTargets.progressIndicator, not(isPresent())));
  }

  static successAlertToContainMessage(message: string) {
    return Task.where(`#actor waits for success alert to contain message '${message}'`,
        Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(TextThatMightNotYetBeThere.of(WalksTargets.successAlert), includes(message)));
  }

  static successAlertToNotContainMessage(message: string) {
    return Task.where(`#actor waits for success alert to not contain message '${message}'`,
        Check.whether(WalksTargets.successAlert, isPresent())
            .andIfSo(Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(TextThatMightNotYetBeThere.of(WalksTargets.alertMessage), not(includes(message)))));
  }

  static errorAlertToContainMessage(message: string) {
    return Task.where(`#actor waits for error alert to contain message '${message}'`,
        Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(WalksTargets.errorAlert, isPresent()),
        Ensure.that(Text.of(WalksTargets.alertMessage), includes(message)));
  }

  static selectedWalksToReachStatus(...statuses: string[]) {
    return Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(WalksWithStatus.matching(...statuses), equals(true));
  }

  static noSelectedWalksToHaveStatus(...statuses: string[]) {
    return Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(SelectedWalksWithStatus.notMatching(...statuses), equals(true));
  }

  static errorOrCountOfWalksToBe(walkCount: number) {
    return Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(WalksHaveCountOrErrorDisplayed.matching(walkCount), equals(true));
  }

  static countOfSelectedWalksToBe(walkCount: number) {
    return Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(SelectedWalksHaveCount.matching(walkCount), equals(true));
  }

  static countOfWalksToBe(walkCount: number) {
    return Wait.upTo(Duration.ofSeconds(TIMEOUT_IN_SECONDS)).until(WalksHaveCount.matching(walkCount), equals(true));
  }
}
