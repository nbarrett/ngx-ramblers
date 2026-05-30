export const NGX_BREVO_CAMPAIGN_TAG = "ngx-daily-cap-overflow";

export interface NgxBrevoCampaignRecord {
  campaignId: number;
  name: string;
  createdAt: number;
}

export interface BrevoCampaignProgress {
  id: number;
  name: string;
  subject: string;
  status: string;
  sent: number;
  delivered: number;
  remaining: number;
  createdAt: string;
  modifiedAt: string;
  sentDate: string | null;
}

export interface BrevoCampaignQueueSummary {
  dailySendLimit: number | null;
  emailsSentToday: number | null;
  remainingAllowanceToday: number | null;
  pendingCampaigns: BrevoCampaignProgress[];
  completedCampaigns: BrevoCampaignProgress[];
}

export interface CampaignOverflowNotice {
  title: string;
  message: string;
}
