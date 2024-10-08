import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { CreateEmailCampaign } from "@getbrevo/brevo";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import * as http from "http";
import {
  SendCampaignRequest,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { CreateModel } from "@getbrevo/brevo/model/createModel";

const messageType = "brevo:send-email-campaign";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

export async function sendCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const sendCampaignRequest: SendCampaignRequest = req.body;
    const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();
    const createEmailCampaign: CreateEmailCampaign = new SibApiV3Sdk.CreateEmailCampaign();
    apiInstance.setApiKey(SibApiV3Sdk.EmailCampaignsApiApiKeys.apiKey, brevoConfig.apiKey);
    debugLog(`About to send email campaign with  supplied sendCampaignRequest: ${sendCampaignRequest}`);
    apiInstance.sendEmailCampaignNow(sendCampaignRequest.campaignId).then((response: {
      response: http.IncomingMessage;
      body: CreateModel
    }) => {
      debugLog("API called successfully. Returned response: " + JSON.stringify(response));
      const responseSingleInput: StatusMappedResponseSingleInput = mapStatusMappedResponseSingleInput(createEmailCampaign.subject, response, 204);
      successfulResponse({req, res, response: responseSingleInput, messageType, debugLog});
    }).catch((error: any) => {
      handleError(req, res, messageType, debugLog, error);
    });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
