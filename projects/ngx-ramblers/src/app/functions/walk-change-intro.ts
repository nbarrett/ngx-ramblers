import { toPairs, uniq } from "es-toolkit/compat";
import { ComposerDrafting } from "../models/mail.model";
import { WalkChangeIntroField, WalkNotificationLocationFormat } from "../models/walk-notification-field.model";
import { WALK_LOCATION_NOTIFICATION_FIELDS, WALK_NOTIFICATION_FIELDS } from "../models/walk-notification-fields";

export const WALK_CHANGE_INTRO_LOOKBACK_DAYS = 7;

export interface WalkChangeIntroFieldChoice {
  field: string;
  label: string;
  defaultOn: boolean;
}

const EXTRA_WALK_CHANGE_INTRO_CHOICES: WalkChangeIntroFieldChoice[] = [
  {field: WalkChangeIntroField.POSTCODE, label: "Postcode", defaultOn: true},
  {field: WalkChangeIntroField.GRID_REFERENCE, label: "Grid reference", defaultOn: false}
];

export function walkChangeIntroFieldChoices(): WalkChangeIntroFieldChoice[] {
  return toPairs(WALK_NOTIFICATION_FIELDS)
    .filter(([, descriptor]) => descriptor.notify)
    .map(([field, descriptor]) => ({field, label: descriptor.label, defaultOn: descriptor.intro}))
    .concat(EXTRA_WALK_CHANGE_INTRO_CHOICES)
    .sort((left, right) => {
      if (left.defaultOn === right.defaultOn) {
        return left.label.localeCompare(right.label);
      } else {
        return left.defaultOn ? -1 : 1;
      }
    });
}

export function walkChangeLocationFormat(fields: string[]): WalkNotificationLocationFormat {
  return {
    description: WALK_LOCATION_NOTIFICATION_FIELDS.some(field => fields.includes(field)),
    gridReference: fields.includes(WalkChangeIntroField.GRID_REFERENCE),
    postcode: fields.includes(WalkChangeIntroField.POSTCODE)
  };
}

export function walkChangeFieldIsSelected(itemField: string, fields: string[]): boolean {
  if (WALK_LOCATION_NOTIFICATION_FIELDS.includes(itemField)) {
    const format = walkChangeLocationFormat(fields);
    return format.description || format.postcode || format.gridReference;
  } else {
    return fields.includes(itemField);
  }
}

export function defaultWalkChangeIntroFields(): string[] {
  return walkChangeIntroFieldChoices()
    .filter(choice => choice.defaultOn)
    .map(choice => choice.field);
}

export function walkChangeFieldsFrom(drafting: ComposerDrafting | null | undefined): string[] {
  return drafting?.walkChangeFields?.length ? [...drafting.walkChangeFields] : defaultWalkChangeIntroFields();
}

export function walkChangeFieldsAfterToggle(current: string[], field: string, selected: boolean): string[] {
  const next = selected ? uniq([...current, field]) : current.filter(item => item !== field);
  return next.length ? next : current;
}
