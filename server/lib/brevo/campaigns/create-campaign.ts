import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
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
import { systemConfig } from "../../config/system-config";
import { contactUsParentSegment } from "../contacts/unsubscribe-token";

const messageType = "brevo:send-email-campaign";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

async function injectCampaignUnsubscribeUrl(createCampaignRequest: CreateCampaignRequest): Promise<void> {
  const memberMergeFields = createCampaignRequest.params?.memberMergeFields;
  if (!memberMergeFields || memberMergeFields.UNSUBSCRIBE_URL) return;
  const listId = createCampaignRequest.recipients?.listIds?.[0];
  if (!Number.isFinite(listId)) return;
  const requestAppUrl = createCampaignRequest.params?.systemMergeFields?.APP_URL;
  const sys = await systemConfig();
  const groupHref = (requestAppUrl || sys?.group?.href || "").replace(/\/+$/, "");
  if (!groupHref) return;
  const parent = await contactUsParentSegment();
  const path = parent ? `/${parent}/unsubscribe` : "/unsubscribe";
  memberMergeFields.UNSUBSCRIBE_URL = `${groupHref}/api/mail/unsubscribe/from-list?email={{ contact.EMAIL }}&listId=${listId}&redirect=${encodeURIComponent(path)}`;
}

async function createEmailCampaignWithTagFallback(apiInstance: SibApiV3Sdk.EmailCampaignsApi, createEmailCampaign: CreateEmailCampaign, debugLog: any) {
  try {
    return await scheduleBrevo(() => apiInstance.createEmailCampaign(createEmailCampaign));
  } catch (error: any) {
    if (error?.statusCode !== 405 || !createEmailCampaign.tag) {
      throw error;
    }
    debugLog("Brevo rejected the campaign tag (405); this account's plan does not allow campaign tags. Retrying without the tag so the campaign can send. Campaigns sent without the tag are not tracked in the managed Campaign Queue.", error?.body);
    createEmailCampaign.tag = undefined;
    return scheduleBrevo(() => apiInstance.createEmailCampaign(createEmailCampaign));
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const createCampaignRequest: CreateCampaignRequest = req.body;
    await injectCampaignUnsubscribeUrl(createCampaignRequest);
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
    createEmailCampaign.header = "If you are not able to see this mail, click {here}";
    createEmailCampaign.footer = "<!--[if !mso]><!--><span style=\"display:none;visibility:hidden;font-size:0;line-height:0;color:transparent;height:0;width:0;overflow:hidden\" aria-hidden=\"true\">{unsubscribe}</span><!--<![endif]-->";
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
    await performTemplateSubstitution(createCampaignRequest, createEmailCampaign, debugLog, true);
    debugLog("Email campaign preparation 2/2 createEmailCampaign:", JSON.stringify(omit(createEmailCampaign, "htmlContent")));
    const response = await createEmailCampaignWithTagFallback(apiInstance, createEmailCampaign, debugLog);
    const responseSingleInput: StatusMappedResponseSingleInput = mapStatusMappedResponseSingleInput(createEmailCampaign.subject, response, 201);
    debugLog("API called successfully. Returned data: " + JSON.stringify(response), "responseSingleInput:", responseSingleInput);
    successfulResponse({req, res, response: responseSingleInput, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
