import { escapeRegExp } from "es-toolkit/compat";
import { MongoCriteria } from "../../models/api-request.model";
import { EventField, GroupEventField } from "../../models/walk.model";

const QUICK_SEARCH_FIELDS: string[] = [
  GroupEventField.TITLE,
  GroupEventField.DESCRIPTION,
  GroupEventField.LOCATION_DESCRIPTION,
  GroupEventField.ADDITIONAL_DETAILS,
  GroupEventField.START_LOCATION_DESCRIPTION,
  GroupEventField.START_LOCATION_NAME,
  GroupEventField.START_LOCATION_POSTCODE,
  GroupEventField.START_LOCATION_TOWN,
  GroupEventField.GROUP_NAME,
  GroupEventField.GROUP_CODE,
  GroupEventField.WALK_LEADER_NAME,
  EventField.CONTACT_DETAILS_DISPLAY_NAME,
  EventField.CONTACT_DETAILS_PHONE,
  EventField.CONTACT_DETAILS_MEMBER_ID
];

export function quickSearchCriteria(searchTerm: string): MongoCriteria | null {
  const trimmed = (searchTerm || "").trim();
  if (!trimmed) {
    return null;
  }
  const regex = { $regex: escapeRegExp(trimmed), $options: "i" };
  return {
    $or: QUICK_SEARCH_FIELDS.map(field => ({ [field]: regex }))
  };
}
