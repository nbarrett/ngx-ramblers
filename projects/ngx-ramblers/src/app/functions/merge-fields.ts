import { isObject, toPairs } from "es-toolkit/compat";
import {
  BOOKING_MERGE_FIELD_CATALOGUE,
  LINK_DESTINATIONS,
  MemberMergeFieldHint,
  MERGE_FIELD_CATALOGUE,
  MergeFieldAppearance,
  MergeFieldGroup,
  PROGRAMME_EVENT_MERGE_FIELDS,
  VOLUNTEER_MERGE_FIELD_CATALOGUE
} from "../models/email-composer.model";

const FIELD_LABEL_BY_TOKEN: Record<string, string> = {};
const APPEARANCE_BY_TOKEN: Record<string, MergeFieldAppearance> = {};
const EXAMPLE_VALUE_BY_TOKEN: Record<string, string> = {};

function rememberField(field: MemberMergeFieldHint): void {
  FIELD_LABEL_BY_TOKEN[field.token] = field.label;
  if (field.appearance) {
    APPEARANCE_BY_TOKEN[field.token] = field.appearance;
  }
  if (field.example) {
    EXAMPLE_VALUE_BY_TOKEN[field.token] = field.example;
  }
}

MERGE_FIELD_CATALOGUE.forEach(group => group.fields.forEach(rememberField));
BOOKING_MERGE_FIELD_CATALOGUE.forEach(group => group.fields.forEach(rememberField));
VOLUNTEER_MERGE_FIELD_CATALOGUE.forEach(group => group.fields.forEach(rememberField));
LINK_DESTINATIONS.forEach(rememberField);
PROGRAMME_EVENT_MERGE_FIELDS.forEach(rememberField);

export function registerLinkDestinations(extras: MemberMergeFieldHint[]): void {
  extras.forEach(rememberField);
}

export function registerMergeFieldCatalogue(groups: MergeFieldGroup[]): void {
  groups.forEach(group => group.fields.forEach(rememberField));
}

function catalogueKey(token: string): string {
  const inner = stripMergeFieldBraces(token);
  const imageHeight = /^(image):\d+$/.exec(inner);
  return `{{${imageHeight ? imageHeight[1] : inner}}}`;
}

export function appearanceForToken(token: string): MergeFieldAppearance {
  return APPEARANCE_BY_TOKEN[catalogueKey(token)] || MergeFieldAppearance.TEXT;
}

function humanizeToken(inner: string): string {
  const lastSegment = inner.split(".").pop() || inner;
  return lastSegment.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

export function stripMergeFieldBraces(raw: string): string {
  return (raw || "").replace(/^\{\{\s*|\s*}}$/g, "");
}

export function friendlyFieldLabel(token: string): string {
  const withBraces = catalogueKey(token);
  let result = withBraces;
  if (FIELD_LABEL_BY_TOKEN[withBraces]) {
    result = FIELD_LABEL_BY_TOKEN[withBraces];
  } else {
    const baseMatch = withBraces.match(/^\{\{\s*([^}]+?)\s*\}\}/);
    if (baseMatch) {
      const baseLabel = FIELD_LABEL_BY_TOKEN[`{{${baseMatch[1].trim()}}}`] || humanizeToken(baseMatch[1].trim());
      const trailing = withBraces.slice(baseMatch[0].length);
      result = trailing ? `${baseLabel}${trailing}` : baseLabel;
    }
  }
  return result;
}

export function friendlyText(text: string): string {
  return (text || "").replace(/\{\{[^}]+\}\}/g, match => friendlyFieldLabel(match));
}

export function registerExampleValues(params: unknown): void {
  const walk = (node: unknown, path: string): void => {
    if (isObject(node)) {
      toPairs(node as Record<string, unknown>).forEach(([key, value]) => {
        const nextPath = path ? `${path}.${key}` : key;
        if (isObject(value)) {
          walk(value, nextPath);
        } else {
          EXAMPLE_VALUE_BY_TOKEN[`{{params.${nextPath}}}`] = value == null ? "" : String(value);
        }
      });
    }
  };
  walk(params, "");
}

export function exampleValueForToken(token: string): string {
  const withBraces = catalogueKey(token);
  let result = "";
  if (EXAMPLE_VALUE_BY_TOKEN[withBraces] != null) {
    result = EXAMPLE_VALUE_BY_TOKEN[withBraces];
  } else {
    const baseMatch = withBraces.match(/^\{\{\s*([^}]+?)\s*\}\}/);
    if (baseMatch) {
      const baseValue = EXAMPLE_VALUE_BY_TOKEN[`{{${baseMatch[1].trim()}}}`];
      if (baseValue != null) {
        result = `${baseValue}${withBraces.slice(baseMatch[0].length)}`;
      }
    }
  }
  return result;
}

export function exampleText(text: string): string {
  return (text || "").replace(/\{\{[^}]+\}\}/g, match => exampleValueForToken(match) || friendlyFieldLabel(match));
}
