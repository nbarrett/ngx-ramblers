import { Request, Response } from "express";
import { MailchimpApiError, MailchimpCampaignGetContentResponse, MailchimpCampaignSearchResponse } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpCampaignSearchRequestOptions, MailchimpConfigData } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { asBoolean } from "../../shared/string-utils";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import debug from "debug";

const debugLog = debug(envConfig.logNamespace("mailchimp:campaigns:search"));
debugLog.debug = false;
export function campaignSearch(req: Request, res: Response): Promise<void> {
  const messageType = "campaign search";
  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
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
    debugLog("req.query:", req.query, "search options:", options);
    const query: string = req.query.query?.toString();
    return mailchimpConfigData.client.searchCampaigns.search(query, options)
      .then((searchResponse: MailchimpCampaignSearchResponse) => {
        messageProcessing.successfulResponse(req, res, searchResponse, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
