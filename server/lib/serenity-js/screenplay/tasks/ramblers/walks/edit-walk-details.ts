import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { isPresent } from "@serenity-js/assertions";
import { Scroll } from "@serenity-js/web";
import {
  WALK_EDIT_FIELD_STEPS,
  WalkEditStep,
  WalkFieldChange
} from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";
import { Accept } from "../common/accept-cookie-prompt";
import { ApplyWalkFieldChanges } from "./apply-walk-field-changes";

export const STEPS_EDITED_BEFORE_IMAGES: WalkEditStep[] = [WalkEditStep.BASIC_INFORMATION, WalkEditStep.LOCATION, WalkEditStep.GRADING];

export function changesForStep(fieldChanges: WalkFieldChange[], step: WalkEditStep): WalkFieldChange[] {
  return (fieldChanges || []).filter(change => WALK_EDIT_FIELD_STEPS[change.field] === step);
}

export class EditWalkDetails extends Task {

  static forStep(step: WalkEditStep, fieldChanges: WalkFieldChange[]): EditWalkDetails {
    return new EditWalkDetails(step, changesForStep(fieldChanges, step));
  }

  constructor(private readonly step: WalkEditStep, private readonly fieldChanges: WalkFieldChange[]) {
    super(`#actor edits ${fieldChanges.map(change => change.field).join(", ") || "nothing"} on the ${step} step`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    if (this.fieldChanges.length === 0) {
      return;
    }
    await actor.attemptsTo(
      ClickWhenReady.on(WalksPageElements.walkStepLink(this.step)),
      Accept.dismissCookieBanners(),
      ApplyWalkFieldChanges.to(this.fieldChanges),
      Scroll.to(WalksPageElements.publishChangesButton),
      ClickWhenReady.on(WalksPageElements.publishChangesButton),
      Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.alertMessage, isPresent()));
  }
}
