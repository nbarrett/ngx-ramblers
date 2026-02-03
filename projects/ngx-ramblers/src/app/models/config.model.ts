import { Identifiable } from "./api-response.model";

export enum ConfigKey {
  BREVO = "brevo",
  COMMITTEE = "committee",
  ENVIRONMENTS = "environments",
  MAIL = "mail",
  MAILCHIMP = "mailchimp",
  MEETUP = "meetup",
  MIGRATION = "migration",
  RAMBLERS_AREAS_CACHE = "ramblers-areas-cache",
  SYSTEM = "system",
  WALKS = "walks",
}

export interface ConfigDocument extends Identifiable {
  key: ConfigKey;
  value: any;
}
