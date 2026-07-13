import { cloneDeep, get, isArray, isEqual, isNull, isObject, isString, isUndefined, keys, pick, set } from "es-toolkit/compat";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { AUDITED_FIELDS, WalkEvent } from "../../models/walk-event.model";
import { EventType } from "../../models/walk.model";

export function normaliseWalkEventSnapshot(value: any): any {
  if (isUndefined(value) || isNull(value)) {
    return null;
  }
  if (isString(value)) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (isArray(value)) {
    return value
      .map(item => normaliseWalkEventSnapshot(item))
      .filter(item => !isNull(item) && !isUndefined(item));
  }
  if (isObject(value)) {
    const response = {};
    keys(value).forEach(key => {
      const normalisedValue = normaliseWalkEventSnapshot(value[key]);
      if (!isNull(normalisedValue) && !isUndefined(normalisedValue)) {
        response[key] = normalisedValue;
      }
    });
    return keys(response).length > 0 ? response : null;
  }
  return value;
}

export function walkEventDataSnapshot(event: ExtendedGroupEvent): object {
  return normaliseWalkEventSnapshot(pick(event, AUDITED_FIELDS));
}

export function walkEventSnapshotEvent(event: ExtendedGroupEvent, eventType: EventType, date: number, memberId: string, reason: string): WalkEvent {
  return {
    data: walkEventDataSnapshot(event),
    eventType,
    date,
    memberId,
    reason
  };
}

export function systemWalkDetailsUpdatedEvent(event: ExtendedGroupEvent, date: number, reason: string): WalkEvent {
  return walkEventSnapshotEvent(event, EventType.WALK_DETAILS_UPDATED, date, "system", reason);
}

export function walkWithUserChanges(persistedWalk: ExtendedGroupEvent, initialisedWalk: ExtendedGroupEvent, currentWalk: ExtendedGroupEvent): ExtendedGroupEvent {
  const walk = cloneDeep(persistedWalk);
  AUDITED_FIELDS.forEach(fieldName => {
    const fieldPath = fieldName.split(".");
    const initialisedValue = get(initialisedWalk, fieldPath);
    const currentValue = get(currentWalk, fieldPath);
    if (!isEqual(initialisedValue, currentValue)) {
      set(walk, fieldPath, cloneDeep(currentValue));
    }
  });
  return walk;
}
