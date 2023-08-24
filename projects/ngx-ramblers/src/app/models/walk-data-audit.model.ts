import { ChangedItem } from "./changed-item.model";
import { EventType } from "./walk.model";

export interface WalkDataAudit {
  eventExists: boolean;
  notificationRequired: boolean;
  changedItems: ChangedItem[];
  dataChanged: boolean;
  eventType: EventType;
  currentData: object;
  previousData: object;
}
