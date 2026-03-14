import { WalkDataAudit } from "./walk-data-audit.model";
import { WalkEvent } from "./walk-event.model";
import { EventType } from "./walk.model";
import { WalkEventType } from "./walk-event-type.model";
import { NotificationConfig } from "./mail.model";
import { ExtendedGroupEvent } from "./group-event.model";
import { Walk } from "./deprecated";
import { WalkConfigTab, WalksConfig } from "./walks-config.model";
import { NotificationHost } from "./notification-host.model";
import { AlertLike } from "./alert.model";

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
  notificationDirective: NotificationHost;
  notify: AlertLike;
  walkEventType: WalkEventType;
  memberIds: string[];
  notificationText: string;
  notificationConfig: NotificationConfig;
  emailSubject: string;
  destination: string;
}
