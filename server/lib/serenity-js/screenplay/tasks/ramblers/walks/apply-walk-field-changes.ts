import { Answerable, AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { Enter, PageElement, Scroll } from "@serenity-js/web";
import debug from "debug";
import { WalkEditField, WalkFieldChange } from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { envConfig } from "../../../../../env-config/env-config";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";

const debugLog = debug(envConfig.logNamespace("ApplyWalkFieldChanges"));
debugLog.enabled = true;

export class ApplyWalkFieldChanges extends Task {

  static to(fieldChanges: WalkFieldChange[]): ApplyWalkFieldChanges {
    return new ApplyWalkFieldChanges(fieldChanges || []);
  }

  constructor(private readonly fieldChanges: WalkFieldChange[]) {
    super(`#actor changes ${fieldChanges.map(change => change.field).join(", ") || "no walk fields"}`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    await this.fieldChanges.reduce(async (previousChanges: Promise<void>, change: WalkFieldChange) => {
      await previousChanges;
      debugLog("changing", change.field, "from", change.existingValue, "to", change.value);
      const option: Answerable<PageElement> = selectableOptionFor(change);
      if (option) {
        await actor.attemptsTo(Scroll.to(option), ClickWhenReady.on(option));
      } else {
        const field: Answerable<PageElement> = fieldElementFor(change.field);
        await actor.attemptsTo(Scroll.to(field), Enter.theValue(change.value).into(field));
      }
    }, Promise.resolve());
  }
}

function selectableOptionFor(change: WalkFieldChange): Answerable<PageElement> {
  const selectableFields: WalkEditField[] = [WalkEditField.WALK_TYPE, WalkEditField.DIFFICULTY];
  return selectableFields.includes(change.field) ? WalksPageElements.walkOptionLabelled(change.value) : null;
}

function fieldElementFor(field: WalkEditField): Answerable<PageElement> {
  const fieldElements: Partial<Record<WalkEditField, Answerable<PageElement>>> = {
    [WalkEditField.TITLE]: WalksPageElements.walkTitleField,
    [WalkEditField.DATE]: WalksPageElements.walkDateField,
    [WalkEditField.START_TIME]: WalksPageElements.walkStartTimeField,
    [WalkEditField.DESCRIPTION]: WalksPageElements.walkDescriptionEditor,
    [WalkEditField.ADDITIONAL_DETAILS]: WalksPageElements.walkAdditionalDetailsEditor,
    [WalkEditField.WEBSITE_LINK]: WalksPageElements.walkWebsiteLinkField,
    [WalkEditField.MEETING_TIME]: WalksPageElements.walkMeetingTimeField,
    [WalkEditField.DISTANCE_KM]: WalksPageElements.walkDistanceKilometresField,
    [WalkEditField.DISTANCE_MILES]: WalksPageElements.walkDistanceMilesField,
    [WalkEditField.ASCENT_METRES]: WalksPageElements.walkAscentMetresField,
    [WalkEditField.ASCENT_FEET]: WalksPageElements.walkAscentFeetField,
    [WalkEditField.FINISH_TIME]: WalksPageElements.walkFinishTimeField
  };
  const fieldElement: Answerable<PageElement> = fieldElements[field];
  if (!fieldElement) {
    throw new Error(`No Walks Manager field is mapped for ${field}`);
  }
  return fieldElement;
}
