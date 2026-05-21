import { BrevoContactCampaignStats, BrevoContactDetails, BrevoEmailEvent } from "../../../models/mail.model";

export interface BrevoContactViewState {
  loading: boolean;
  loadingMore: boolean;
  canLoadMore: boolean;
  eventsDays: number;
  eventsLimit: number;
  events: BrevoEmailEvent[];
  contactDetails: BrevoContactDetails | null;
  campaignStats: BrevoContactCampaignStats | null;
  error: string | null;
}

export interface BrevoStatTile {
  key: string;
  label: string;
  value: number;
}

export interface BrevoEventGroup {
  label: string;
  events: BrevoEmailEvent[];
}
