import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { asBoolean } from "../../shared/string-utils";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import debug from "debug";
import {
  MailchimpCampaignSearchRequestOptions,
  MailchimpConfigData
} from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import {
  MailchimpApiError,
  MailchimpCampaignGetContentResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";

const messageType = "mailchimp:campaigns:get-content";
const debugLog = debug(envConfig.logNamespace(messageType));

export function campaignGetContent(req: Request, res: Response): Promise<void> {
  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const campaignId = req.params.campaignId;
    const options: MailchimpCampaignSearchRequestOptions = {
      fields: asBoolean(req.query.concise) ? [
        "results.campaign.create_time",
        "results.campaign.id",
        "results.campaign.long_archive_url",
        "results.campaign.recipients.list_id",
        "results.campaign.recipients.segment_opts.saved_segment_id",
        "results.campaign.send_time",
        "results.campaign.settings.from_name",
        "results.campaign.settings.subject_line",
        "results.campaign.settings.template_id",
        "results.campaign.settings.title",
        "results.campaign.status",
        "results.campaign.web_id",
      ] : null,
    };
    debugLog("campaignId:", campaignId, "pptions:", options);
    return mailchimpConfigData.client.campaigns.getContent(campaignId, options)
      .then((getContentResponse: MailchimpCampaignGetContentResponse) => {
        messageProcessing.successfulResponse(req, res, getContentResponse, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
