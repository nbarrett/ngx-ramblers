import { inject, Injectable } from "@angular/core";
import { MailchimpContact, MailchimpListCreateRequest } from "../models/server-models";
import { ConfigKey } from "../models/config.model";
import { MailchimpCampaignDefaults, MailchimpConfig } from "../models/mailchimp.model";
import { ConfigService } from "./config.service";
import { KeyValue } from "../functions/enums";
import map from "lodash-es/map";

@Injectable({
  providedIn: "root"
})
export class MailchimpConfigService {

  private config = inject(ConfigService);
  public campaignDefaults: MailchimpCampaignDefaults = {
    from_name: null,
    from_email: null,
    language: "English",
    subject: ""
  };

  public contactDefaults: MailchimpContact = {address1: null, city: null, company: null, country: "UK"};
  public SegmentDefaults = {
    passwordResetSegmentId: null,
    forgottenPasswordSegmentId: null,
    welcomeSegmentId: null,
    committeeSegmentId: null,
    expiredMembersSegmentId: null,
    expiredMembersWarningSegmentId: null
  };

  async getConfig(): Promise<MailchimpConfig> {
    return await this.config.queryConfig<MailchimpConfig>(ConfigKey.MAILCHIMP, {
      apiUrl: null,
      apiKey: null,
      allowSendCampaign: false,
      campaignDefaults: this.campaignDefaults,
      contactDefaults: this.contactDefaults,
      mailchimpEnabled: false,
      lists: {
        walks: null,
        socialEvents: null,
        general: null
      },
      segments: {
        general: this.SegmentDefaults
      },
      campaigns: {
        walkNotification: {campaignId: null, name: null, monthsInPast: null},
        expenseNotification: {campaignId: null, name: null, monthsInPast: null},
        passwordReset: {campaignId: null, name: null, monthsInPast: null},
        forgottenPassword: {campaignId: null, name: null, monthsInPast: null},
        welcome: {campaignId: null, name: null, monthsInPast: null},
        socialEvents: {campaignId: null, name: null, monthsInPast: null},
        committee: {campaignId: null, name: null, monthsInPast: null},
        expiredMembers: {campaignId: null, name: null, monthsInPast: null},
        newsletter: {campaignId: null, name: null, monthsInPast: null},
        expiredMembersWarning: {campaignId: null, name: null, monthsInPast: null},
      }
    });
  }

  saveConfig(config: MailchimpConfig) {
    return this.config.saveConfig<MailchimpConfig>(ConfigKey.MAILCHIMP, config);
  }

  setCampaignDefaults(mailchimpConfig: MailchimpConfig) {
    mailchimpConfig.campaignDefaults = this.campaignDefaults;
    mailchimpConfig.contactDefaults = this.contactDefaults;
  }

  createMailchimpListCreateRequest(contactDefaults: MailchimpContact, campaignDefaults: MailchimpCampaignDefaults): MailchimpListCreateRequest {
    return {
      contact: contactDefaults,
      campaign_defaults: campaignDefaults,
      double_optin: false,
      email_type_option: true,
      marketing_permissions: true,
      notify_on_subscribe: "",
      notify_on_unsubscribe: "",
      permission_reminder: "You were added by us automatically when you joined the group",
      use_archive_bar: false,
    };
  }

  public configuredListTypes(config: MailchimpConfig): KeyValue<string>[] {
    return map(config.lists, (value, key) => ({key, value}));
  }

}
