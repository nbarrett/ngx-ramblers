import { WalkDataAudit } from "./walk-data-audit.model";
import { WalkEvent } from "./walk-event.model";
import { EventType, Walk } from "./walk.model";

export interface WalkNotification {
  walk: Walk;
  status: EventType;
  event: WalkEvent;
  walkDataAudit: WalkDataAudit;
  validationMessages: string[];
  reason?: string;
}

export interface CurrentPreviousData {
  currentData: object;
  previousData?: object;
}
