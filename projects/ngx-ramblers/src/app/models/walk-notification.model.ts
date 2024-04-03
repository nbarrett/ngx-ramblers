import { WalkDataAudit } from "./walk-data-audit.model";
import { WalkEvent } from "./walk-event.model";
import { EventType, Walk } from "./walk.model";
import { NotificationDirective } from "../notifications/common/notification.directive";
import { AlertInstance } from "../services/notifier.service";
import { Member } from "./member.model";
import { WalkEventType } from "./walk-event-type.model";
import { NotificationConfig } from "./mail.model";

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

export interface WalkMailMessageConfiguration {
  notificationDirective: NotificationDirective;
  notify: AlertInstance;
  walkEventType: WalkEventType;
  memberIds: string[];
  notificationText: string;
  notificationConfig: NotificationConfig;
  emailSubject: string;
  destination: string;
}
