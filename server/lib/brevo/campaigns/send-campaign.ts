import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import {
  SendCampaignRequest,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:send-email-campaign";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

export async function sendCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const sendCampaignRequest: SendCampaignRequest = req.body;
    debugLog(`About to send email campaign with  supplied sendCampaignRequest: ${sendCampaignRequest}`);
    scheduleBrevo(() => client.emailCampaigns.sendEmailCampaignNow({campaignId: sendCampaignRequest.campaignId}).withRawResponse()).then((response) => {
      debugLog("API called successfully. Returned response: " + JSON.stringify(response));
      const responseSingleInput: StatusMappedResponseSingleInput = mapStatusMappedResponseSingleInput(sendCampaignRequest.campaignId, response, 204);
      successfulResponse({req, res, response: responseSingleInput, messageType, debugLog});
    }).catch((error: any) => {
      handleError(req, res, messageType, debugLog, error);
    });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
