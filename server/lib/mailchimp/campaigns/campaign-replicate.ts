import debug from "debug";
import { Request, Response } from "express";
import { MailchimpApiError } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";

const messageType = "mailchimp:campaigns:replicate";
const debugLog = debug(envConfig.logNamespace(messageType));

export function campaignReplicate(req: Request, res: Response): Promise<void> {
  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    debugLog("campaignId:", req.params.campaignId);
    return mailchimpConfigData.client.campaigns.replicate(req.params.campaignId)
      .then(responseData => {
        messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
