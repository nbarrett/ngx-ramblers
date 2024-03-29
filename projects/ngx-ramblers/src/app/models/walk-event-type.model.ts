import { EventType } from "./walk.model";
import { Type } from "@angular/core";
import {
  WalkNotificationDetailsComponent
} from "../notifications/walks/templates/common/walk-notification-details.component";

export interface WalkEventType {
  eventType: EventType;
  mustHaveLeader?: boolean;
  mustPassValidation?: boolean;
  showDetails?: boolean;
  readyToBe?: string;
  statusChange?: boolean;
  description: string;
  notifyLeader?: boolean;
  notifyCoordinator?: boolean;
}

export interface WalkEventNotificationMapping {
  eventType: EventType;
  notifyLeader?: Type<WalkNotificationDetailsComponent>;
  notifyCoordinator?: Type<WalkNotificationDetailsComponent>;
}
