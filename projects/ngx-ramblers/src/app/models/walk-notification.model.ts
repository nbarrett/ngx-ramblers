import { WalkDataAudit } from "./walk-data-audit.model";
import { WalkEvent } from "./walk-event.model";
import { EventType } from "./walk.model";
import { NotificationDirective } from "../notifications/common/notification.directive";
import { AlertInstance } from "../services/notifier.service";
import { WalkEventType } from "./walk-event-type.model";
import { NotificationConfig } from "./mail.model";
import { ExtendedGroupEvent } from "./group-event.model";
import { Walk } from "./deprecated";

export interface WalkNotification {
  walk: ExtendedGroupEvent;
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

export interface WalksConfig {
  milesPerHour: number;
}
