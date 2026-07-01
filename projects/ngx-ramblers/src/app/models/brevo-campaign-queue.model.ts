export const NGX_BREVO_CAMPAIGN_TAG = "ngx-daily-cap-overflow";

export interface NgxBrevoCampaignRecord {
  campaignId: number;
  name: string;
  createdAt: number;
}

export interface BrevoCampaignSender {
  name?: string;
  email?: string;
}

export interface BrevoCampaignAudienceList {
  id: number;
  name: string;
  uniqueSubscribers: number;
}

export interface BrevoCampaignProgress {
  id: number;
  name: string;
  subject: string;
  status: string;
  sent: number;
  delivered: number;
  remaining: number;
  uniqueClicks: number;
  viewed: number;
  uniqueViews: number;
  hardBounces: number;
  softBounces: number;
  unsubscriptions: number;
  complaints: number;
  createdAt: string;
  modifiedAt: string;
  sentDate: string | null;
  sender?: BrevoCampaignSender;
  replyTo?: string;
  listIds?: number[];
  audienceLists?: BrevoCampaignAudienceList[];
}

export interface BrevoCampaignQueueSummary {
  emailsSentToday: number | null;
  remainingAllowanceToday: number | null;
  pendingCampaigns: BrevoCampaignProgress[];
  completedCampaigns: BrevoCampaignProgress[];
  aggregateStats: BrevoCampaignAggregateStats | null;
}

export interface BrevoCampaignAggregateStats {
  totalSent: number;
  totalDelivered: number;
  totalViewed: number;
  totalUniqueViews: number;
  totalUniqueClicks: number;
  totalHardBounces: number;
  totalSoftBounces: number;
  totalUnsubscriptions: number;
  totalComplaints: number;
  campaignCount: number;
}

export interface CampaignOverflowNotice {
  title: string;
  message: string;
}
