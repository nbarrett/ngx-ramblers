import debug from "debug";
import { Request, Response } from "express";
import { MailchimpApiError, MailchimpCampaignContentUpdateRequest, MailchimpSetContentResponse } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData } from "../../shared/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";

const messageType = "mailchimp:campaigns:set-content";
const debugLog = debug(envConfig.logNamespace(messageType));

export function campaignSetContent(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const mailchimpCampaignContentUpdateRequest: MailchimpCampaignContentUpdateRequest = req.body;
    debugLog("mailchimpCampaignContentUpdateRequest:", mailchimpCampaignContentUpdateRequest);
    return mailchimpConfigData.client.campaigns.setContent(req.params.campaignId, mailchimpCampaignContentUpdateRequest)
      .then((responseData: MailchimpSetContentResponse) => {
        messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
