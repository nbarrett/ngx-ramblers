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
  UpdateTemplateRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:template-management";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

async function apiInstance(): Promise<SibApiV3Sdk.TransactionalEmailsApi> {
  const brevoConfig = await configuredBrevo();
  const api = new SibApiV3Sdk.TransactionalEmailsApi();
  api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
  return api;
}

export async function findTemplateByName(templateName: string): Promise<MailTemplate | null> {
  const api = await apiInstance();
  const response: {
    response: http.IncomingMessage;
    body: GetSmtpTemplates;
  } = await api.getSmtpTemplates(true);

  debugLog("findTemplateByName: searching for", templateName);
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

  debugLog("updateTemplate: updating template", request.templateId);
  await api.updateSmtpTemplate(request.templateId, updateSmtpTemplate);
  debugLog("updateTemplate: updated successfully");
}

export async function createOrUpdateTemplate(request: CreateTemplateRequest): Promise<number> {
  const existing = await findTemplateByName(request.templateName);

  if (existing) {
    debugLog("createOrUpdateTemplate: updating existing template", existing.id);
    await updateTemplate({
      templateId: existing.id,
      htmlContent: request.htmlContent,
      subject: request.subject,
      isActive: request.isActive
    });
    return existing.id;
  }

  debugLog("createOrUpdateTemplate: creating new template");
  const created = await createTemplate(request);
  return created.id;
}
