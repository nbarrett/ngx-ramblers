import * as SibApiV3Sdk from "@getbrevo/brevo";
import { GetSmtpTemplates } from "@getbrevo/brevo";
import debug from "debug";
import * as http from "http";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import {
  CreateTemplateRequest,
  CreateTemplateResponse,
  MailTemplate,
  MailTemplates,
  Sender,
  UpdateTemplateRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { isBoolean, isObject } from "es-toolkit/compat";

const messageType = "brevo:template-management";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

async function apiInstance(): Promise<SibApiV3Sdk.TransactionalEmailsApi> {
  const brevoConfig = await configuredBrevo();
  const api = new SibApiV3Sdk.TransactionalEmailsApi();
  api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
  return api;
}

async function sendersApiInstance(): Promise<SibApiV3Sdk.SendersApi> {
  const brevoConfig = await configuredBrevo();
  const api = new SibApiV3Sdk.SendersApi();
  api.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
  return api;
}

export async function listTemplates(templateStatus?: boolean | null): Promise<MailTemplates> {
  const api = await apiInstance();
  const statusValue = isBoolean(templateStatus) ? templateStatus : undefined;
  const response: {
    response: http.IncomingMessage;
    body: GetSmtpTemplates;
  } = await api.getSmtpTemplates(statusValue);
  const templates: MailTemplate[] = response.body.templates?.map(template => ({
    createdAt: template.createdAt,
    sender: {name: template.sender.name, email: template.sender.email, id: +template.sender.id},
    subject: template.subject,
    doiTemplate: template.doiTemplate,
    modifiedAt: template.modifiedAt,
    toField: template.toField,
    name: template.name,
    replyTo: template.replyTo,
    id: template.id,
    tag: template.tag,
    isActive: template.isActive,
    testSent: template.testSent,
    htmlContent: null
  })) || [];
  return {
    count: response.body.count || 0,
    templates
  };
}

export async function getDefaultSender(): Promise<Sender | null> {
  try {
    const api = await sendersApiInstance();
    const response: { response: http.IncomingMessage; body: any } = await api.getSenders();
    const allSenders = response.body?.senders || [];
    const activeSenders = allSenders.filter((s: any) => s.active === true);
    debugLog("getDefaultSender: found", allSenders.length, "senders,", activeSenders.length, "active");
    if (activeSenders.length > 0) {
      const sender = activeSenders[0];
      debugLog("getDefaultSender: using active sender", sender.name, sender.email);
      return { id: sender.id, name: sender.name, email: sender.email, active: sender.active };
    }
    debugLog("getDefaultSender: no active senders found");
    return null;
  } catch (error) {
    debugLog("getDefaultSender: error fetching senders:", error);
    return null;
  }
}

export async function findTemplateByName(templateName: string): Promise<MailTemplate | null> {
  try {
    const api = await apiInstance();
    debugLog("findTemplateByName: fetching templates from Brevo API");
    const response: {
      response: http.IncomingMessage;
      body: GetSmtpTemplates;
    } = await api.getSmtpTemplates(true);

    debugLog("findTemplateByName: searching for", templateName, "in", response.body.templates?.length || 0, "templates");
    const template = response.body.templates?.find(t => t.name === templateName);

    if (!template) {
      debugLog("findTemplateByName: template not found");
      return null;
    }

    debugLog("findTemplateByName: found template", template.id);
    return {
      id: template.id,
      name: template.name,
      subject: template.subject,
      isActive: template.isActive,
      testSent: template.testSent,
      createdAt: template.createdAt,
      modifiedAt: template.modifiedAt,
      sender: { name: template.sender.name, email: template.sender.email, id: +template.sender.id },
      replyTo: template.replyTo,
      toField: template.toField,
      tag: template.tag,
      doiTemplate: template.doiTemplate,
      htmlContent: null
    };
  } catch (error) {
    debugLog("findTemplateByName: API error:", error);
    if (isObject(error) && "body" in error) {
      debugLog("findTemplateByName: API error body:", JSON.stringify((error as any).body, null, 2));
    }
    throw error;
  }
}

export async function createTemplate(request: CreateTemplateRequest): Promise<CreateTemplateResponse> {
  const api = await apiInstance();
  const createSmtpTemplate = new SibApiV3Sdk.CreateSmtpTemplate();
  createSmtpTemplate.templateName = request.templateName;
  createSmtpTemplate.htmlContent = request.htmlContent;
  createSmtpTemplate.subject = request.subject;
  createSmtpTemplate.isActive = request.isActive ?? true;

  if (request.senderName && request.senderEmail) {
    createSmtpTemplate.sender = { name: request.senderName, email: request.senderEmail };
  }

  debugLog("createTemplate: creating template", request.templateName);
  const response = await api.createSmtpTemplate(createSmtpTemplate);
  debugLog("createTemplate: created with id", response.body.id);

  return { id: response.body.id };
}

export async function updateTemplate(request: UpdateTemplateRequest): Promise<void> {
  const api = await apiInstance();
  const updateSmtpTemplate = new SibApiV3Sdk.UpdateSmtpTemplate();

  if (request.htmlContent !== undefined) {
    updateSmtpTemplate.htmlContent = request.htmlContent;
  }
  if (request.subject !== undefined) {
    updateSmtpTemplate.subject = request.subject;
  }
  if (request.templateName !== undefined) {
    updateSmtpTemplate.templateName = request.templateName;
  }
  if (request.isActive !== undefined) {
    updateSmtpTemplate.isActive = request.isActive;
  }
  if (request.senderId) {
    updateSmtpTemplate.sender = { id: request.senderId };
  } else if (request.senderName && request.senderEmail) {
    updateSmtpTemplate.sender = { name: request.senderName, email: request.senderEmail };
  }

  debugLog("updateTemplate: updating template", request.templateId, "with senderId", request.senderId);
  try {
    await api.updateSmtpTemplate(request.templateId, updateSmtpTemplate);
    debugLog("updateTemplate: updated successfully");
  } catch (error) {
    const apiError = error as any;
    const apiErrorMessage = apiError?.body?.message || apiError?.response?.body?.message;
    const apiErrorCode = apiError?.body?.code || apiError?.response?.body?.code;
    const statusCode = apiError?.statusCode || apiError?.response?.statusCode;
    debugLog("updateTemplate: API error:", statusCode, apiErrorCode, apiErrorMessage);
    if (apiErrorMessage) {
      throw new Error(`Brevo API error [${statusCode}] ${apiErrorCode}: ${apiErrorMessage}`);
    }
    throw error;
  }
}

export async function createOrUpdateTemplate(request: CreateTemplateRequest): Promise<number> {
  const existing = await findTemplateByName(request.templateName);

  if (existing) {
    const defaultSender = await getDefaultSender();
    if (!defaultSender || !defaultSender.id) {
      throw new Error("No active sender with ID found in Brevo account. Please configure an active sender first.");
    }

    debugLog("createOrUpdateTemplate: updating existing template", existing.id, "with sender id", defaultSender.id);
    await updateTemplate({
      templateId: existing.id,
      htmlContent: request.htmlContent,
      subject: request.subject,
      isActive: request.isActive,
      senderId: defaultSender.id
    });
    return existing.id;
  }

  const defaultSender = await getDefaultSender();
  if (!defaultSender || !defaultSender.email || !defaultSender.name) {
    throw new Error("No active sender found in Brevo account. Please configure an active sender first.");
  }

  debugLog("createOrUpdateTemplate: creating new template with sender", defaultSender.name, defaultSender.email);
  const created = await createTemplate({
    ...request,
    senderName: defaultSender.name,
    senderEmail: defaultSender.email
  });
  return created.id;
}
