import { Identifiable } from "./api-response.model";

export enum ConfigKey {
  BREVO = "brevo",
  COMMITTEE = "committee",
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
