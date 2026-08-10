import {EventField, GroupEventField, ID} from "../models/walk.model";
import {isMongoId} from "../services/mongo-utils";

export function groupEventIdsCriteria(eventIds: string[]): any {
  const ids = (eventIds || []).filter(Boolean);
  const mongoIds = ids.filter(isMongoId);
  return ids.length > 0 ? {
    $or: [
      ...(mongoIds.length > 0 ? [{[ID]: {$in: mongoIds}}] : []),
      {[GroupEventField.ID]: {$in: ids}},
      {[EventField.MIGRATED_FROM_ID]: {$in: ids}}
    ]
  } : null;
}
