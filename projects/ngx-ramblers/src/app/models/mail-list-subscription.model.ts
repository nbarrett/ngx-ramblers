import { Member } from "./member.model";

export enum ListSubscriptionColumn {
  EMAIL = "Email",
  LIST_NAME = "List Name",
  SUBSCRIBED = "Subscribed"
}

export const LIST_SUBSCRIPTION_COLUMNS: ListSubscriptionColumn[] = [
  ListSubscriptionColumn.EMAIL,
  ListSubscriptionColumn.LIST_NAME,
  ListSubscriptionColumn.SUBSCRIBED
];

export const SUBSCRIBED_YES = "Yes";
export const SUBSCRIBED_NO = "No";
export const LIST_SUBSCRIPTIONS_SHEET_NAME = "List Subscriptions";

export interface ListSubscriptionRow {
  email: string;
  listName: string;
  subscribed: string;
}

export interface ListSubscriptionExportRequest {
  fileName: string;
  rows: ListSubscriptionRow[];
}

export interface ListSubscriptionParseResponse {
  rows: ListSubscriptionRow[];
}

export enum ListSubscriptionOutcome {
  SUBSCRIBED = "Subscribed",
  UNSUBSCRIBED = "Unsubscribed",
  UNCHANGED = "Already as requested",
  NO_MATCHING_MEMBER = "No matching member",
  AMBIGUOUS_MEMBER_MATCH = "Matched more than one member",
  UNKNOWN_LIST = "List not found on this site",
  NO_EMAIL_ADDRESS = "No email address",
  UNRECOGNISED_SUBSCRIBED_VALUE = "Subscribed value not recognised"
}

export const APPLIED_OUTCOMES: ListSubscriptionOutcome[] = [
  ListSubscriptionOutcome.SUBSCRIBED,
  ListSubscriptionOutcome.UNSUBSCRIBED
];

export interface ListSubscriptionResult {
  row: ListSubscriptionRow;
  outcome: ListSubscriptionOutcome;
}

export interface ListSubscriptionImportSummary {
  results: ListSubscriptionResult[];
  membersChanged: Member[];
}

export enum ListSubscriptionAction {
  DOWNLOADING = "downloading",
  PARSING = "parsing",
  APPLYING = "applying"
}

export interface ListSubscriptionChangeCount {
  listName: string;
  subscribersBefore: number;
  subscribing: number;
  unsubscribing: number;
  subscribersAfter: number;
}

export interface RetrospectiveApplyChange {
  member: Member;
  subscribed: boolean;
}

export interface RetrospectiveApplyPreview {
  listId: number;
  listName: string;
  changes: RetrospectiveApplyChange[];
  subscribingCount: number;
  unsubscribingCount: number;
  keptUnsubscribedCount: number;
}
