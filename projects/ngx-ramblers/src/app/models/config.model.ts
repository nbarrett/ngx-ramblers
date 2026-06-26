import { Identifiable } from "./api-response.model";

export enum ConfigKey {
  BOOKING = "booking",
  BREVO = "brevo",
  SCHEDULED_TASKS = "scheduled-tasks",
  COMMITTEE = "committee",
  ENVIRONMENTS = "environments",
  MAIL = "mail",
  MAILCHIMP = "mailchimp",
  MEETUP = "meetup",
  MIGRATION = "migration",
  RAMBLERS_AREAS_CACHE = "ramblers-areas-cache",
  SALESFORCE = "salesforce",
  MEMBER_SYNC_POLICY = "member-sync-policy",
  SYSTEM = "system",
  LEGACY_REDIRECT = "legacy-redirect",
  WALKS = "walks",
}

export interface ConfigDocument extends Identifiable {
  key: ConfigKey;
  value: any;
}
