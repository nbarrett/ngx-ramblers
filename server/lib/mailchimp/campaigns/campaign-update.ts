import debug from "debug";
import { Request, Response } from "express";
import { MailchimpApiError, MailchimpCampaignUpdateRequest } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData } from "../../shared/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";

const messageType = "mailchimp:campaigns:update";
const debugLog = debug(envConfig.logNamespace(messageType));

export function campaignUpdate(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const mailchimpCampaignListRequest: MailchimpCampaignUpdateRequest = req.body;
    return mailchimpConfigData.client.campaigns.update(req.params.campaignId, mailchimpCampaignListRequest)
      .then((responseData: MailchimpCampaignUpdateRequest) => {
        debugLog("campaignId:", req.params.campaignId, "mailchimpCampaignListRequest:", mailchimpCampaignListRequest);
        messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
