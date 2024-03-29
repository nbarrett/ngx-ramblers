import { NotificationConfig } from "./mail.model";

export interface WalkMailMessageConfiguration {
  memberIds: string[];
  notificationText: string;
  notificationConfig: NotificationConfig;
  emailSubject: string;
  destination: string;
}

export interface WalkCampaignConfiguration extends WalkMailMessageConfiguration {
  segmentType: string;
  segmentName: string;
}
