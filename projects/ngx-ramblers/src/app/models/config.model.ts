import { Identifiable } from "./api-response.model";

export enum ConfigKey {
  BREVO = "brevo",
  COMMITTEE = "committee",
  MAILCHIMP = "mailchimp",
  MEETUP = "meetup",
  SYSTEM = "system",
}

export interface ConfigDocument extends Identifiable {
  key: ConfigKey;
  value: any;
}
