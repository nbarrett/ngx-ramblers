import { cloneDeep, keys, pick, set } from "es-toolkit/compat";
import { AUDITED_FIELDS } from "../../../../projects/ngx-ramblers/src/app/models/walk-event.model";
import { GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { parseGridReference } from "../../addresses/grid-reference";

export function walkEventDataFrom(doc: any, updateSet?: Record<string, any>): object {
  const updatedDoc = cloneDeep(doc || {});
  if (updateSet) {
    keys(updateSet).forEach(key => {
      set(updatedDoc, key, updateSet[key]);
    });
  }
  return pick(updatedDoc, AUDITED_FIELDS);
}

export function gridReferenceAudit(doc: any, forceInvalid: boolean = false): {
  gridReference10: string | null;
  gridReference8: string | null;
  gridReference6: string | null;
  validGridReference: string | null;
  invalidFields: string[];
  updateSet: Record<string, any>;
  unsetPayload: Record<string, string>;
} {
  const gridReference10 = doc?.groupEvent?.start_location?.grid_reference_10 || null;
  const gridReference8 = doc?.groupEvent?.start_location?.grid_reference_8 || null;
  const gridReference6 = doc?.groupEvent?.start_location?.grid_reference_6 || null;
  const gridReferenceCandidates = [
    { field: GroupEventField.START_LOCATION_GRID_REFERENCE_10, value: gridReference10 },
    { field: GroupEventField.START_LOCATION_GRID_REFERENCE_8, value: gridReference8 },
    { field: GroupEventField.START_LOCATION_GRID_REFERENCE_6, value: gridReference6 }
  ].map(candidate => ({
    ...candidate,
    parsed: candidate.value ? parseGridReference(candidate.value) : null
  }));
  const invalidFields = gridReferenceCandidates
    .filter(candidate => candidate.value && (forceInvalid || !candidate.parsed))
    .map(candidate => candidate.field);
  const updateSet = invalidFields.reduce((payload, field) => ({
    ...payload,
    [field]: null
  }), {});
  const unsetPayload = invalidFields.reduce((payload, field) => ({
    ...payload,
    [field]: ""
  }), {});
  const validGridReference = forceInvalid
    ? null
    : gridReferenceCandidates.find(candidate => candidate.value && candidate.parsed)?.value || null;
  return {
    gridReference10: invalidFields.includes(GroupEventField.START_LOCATION_GRID_REFERENCE_10) ? null : gridReference10,
    gridReference8: invalidFields.includes(GroupEventField.START_LOCATION_GRID_REFERENCE_8) ? null : gridReference8,
    gridReference6: invalidFields.includes(GroupEventField.START_LOCATION_GRID_REFERENCE_6) ? null : gridReference6,
    validGridReference,
    invalidFields,
    updateSet,
    unsetPayload
  };
}
