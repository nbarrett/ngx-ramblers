import { Identifiable } from "./api-response.model";

export enum ConfigKey {
  BACKUP = "backup",
  BREVO = "brevo",
  COMMITTEE = "committee",
  MAIL = "mail",
  MAILCHIMP = "mailchimp",
  MEETUP = "meetup",
  MIGRATION = "migration",
  SYSTEM = "system",
  WALKS = "walks",
}

export interface ConfigDocument extends Identifiable {
  key: ConfigKey;
  value: any;
}
