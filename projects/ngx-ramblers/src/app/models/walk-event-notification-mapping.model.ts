import { Type } from "@angular/core";
import { EventType } from "./walk.model";
import { WalkNotificationDetailsComponent } from "../notifications/walks/templates/common/walk-notification-details.component";

export interface WalkEventNotificationMapping {
  eventType: EventType;
  notifyLeader?: Type<WalkNotificationDetailsComponent>;
  notifyCoordinator?: Type<WalkNotificationDetailsComponent>;
}
