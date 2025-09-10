import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { CreateEmailCampaign } from "@getbrevo/brevo";
import {
  handleError,
  mapStatusMappedResponseSingleInput,
  performTemplateSubstitution,
  successfulResponse
} from "../common/messages";
import {
  CreateCampaignRequest,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { omit } from "es-toolkit/compat";
import { dateTimeNow } from "../../shared/dates";

const messageType = "brevo:send-email-campaign";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

export async function createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const createCampaignRequest: CreateCampaignRequest = req.body;
    debugLog("Email campaign preparation 1/2 createCampaignRequest:", JSON.stringify(omit(createCampaignRequest, "htmlContent")));
    const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();
    const createEmailCampaign: CreateEmailCampaign = new SibApiV3Sdk.CreateEmailCampaign();
    apiInstance.setApiKey(SibApiV3Sdk.EmailCampaignsApiApiKeys.apiKey, brevoConfig.apiKey);
    if (createCampaignRequest.createAsDraft) {
      debugLog("Email will be created as a draft so it can be edited and reviewed before sending.");
    } else {
      const scheduledAt = dateTimeNow().plus({ days: 1 }).toISO();
      debugLog("Email campaign preparation scheduling at:", scheduledAt);
      createEmailCampaign.scheduledAt = scheduledAt;
    }
    createEmailCampaign.attachmentUrl = createCampaignRequest.attachmentUrl;
    createEmailCampaign.footer = "If you wish to unsubscribe from our emails, click {here}";
    createEmailCampaign.header = "If you are not able to see this mail, click {here}";
    createEmailCampaign.inlineImageActivation = createCampaignRequest.inlineImageActivation;
    createEmailCampaign.mirrorActive = createCampaignRequest.mirrorActive;
    createEmailCampaign.name = createCampaignRequest.name;
    createEmailCampaign.params = createCampaignRequest.params;
    createEmailCampaign.recipients = createCampaignRequest.recipients;
    createEmailCampaign.replyTo = createCampaignRequest.replyTo;
    createEmailCampaign.sender = createCampaignRequest.sender;
    createEmailCampaign.subject = createCampaignRequest.subject;
    createEmailCampaign.tag = createCampaignRequest.tag;
    createEmailCampaign.toField = "{{contact.FIRSTNAME}} {{contact.LASTNAME}}";
    await performTemplateSubstitution(createCampaignRequest, createEmailCampaign, debugLog);
    debugLog("Email campaign preparation 2/2 createEmailCampaign:", JSON.stringify(omit(createEmailCampaign, "htmlContent")));
    apiInstance.createEmailCampaign(createEmailCampaign)
      .then(response => {
        const responseSingleInput: StatusMappedResponseSingleInput = mapStatusMappedResponseSingleInput(createEmailCampaign.subject, response, 201);
        debugLog("API called successfully. Returned data: " + JSON.stringify(response), "responseSingleInput:", responseSingleInput);
        successfulResponse({req, res, response: responseSingleInput, messageType, debugLog});
      })
      .catch((error: any) => {
        handleError(req, res, messageType, debugLog, error);
      });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
