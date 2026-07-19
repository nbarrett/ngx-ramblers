import { ChangedItem, NotificationChangedItem } from "./changed-item.model";
import { EventType } from "./walk.model";

export interface WalkDataAudit {
  eventExists: boolean;
  notificationRequired: boolean;
  changedItems: ChangedItem[];
  notificationChangedItems: NotificationChangedItem[];
  dataChanged: boolean;
  eventType: EventType;
  currentData: object;
  previousData: object;
}
