import * as SibApiV3Sdk from "@getbrevo/brevo";
import { GetSmtpTemplates } from "@getbrevo/brevo";
import debug from "debug";
import * as http from "http";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { systemConfig } from "../../config/system-config";
import { apexHost } from "../../../../projects/ngx-ramblers/src/app/functions/hosts";
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
const RAMBLERS_TEMPLATE_BACKUP_SUFFIX = "backup-2026-04-06-ramblers-aligned";

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

async function preferredSenderDomain(): Promise<string | null> {
  try {
    const config = await systemConfig();
    const href = config?.group?.href;
    if (!href) {
      return null;
    }
    return apexHost(new URL(href).hostname);
  } catch (error) {
    debugLog("preferredSenderDomain: unable to derive domain", error);
    return null;
  }
}

function invalidSenderDetailsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Unable to update template, please provide valid sender details/i.test(message);
}

export function backupTemplateName(templateName: string, templateId?: number): string {
  const suffix = templateId ? `${RAMBLERS_TEMPLATE_BACKUP_SUFFIX}-${templateId}` : RAMBLERS_TEMPLATE_BACKUP_SUFFIX;
  return `${templateName}-${suffix}`;
}

function newestTemplate(templates: MailTemplate[]): MailTemplate | null {
  return templates.reduce<MailTemplate | null>((latest, template) => {
    if (!latest) {
      return template;
    }
    if (template.isActive !== latest.isActive) {
      return template.isActive ? template : latest;
    }
    const latestTimestamp = latest.modifiedAt || latest.createdAt || "";
    const templateTimestamp = template.modifiedAt || template.createdAt || "";
    if (templateTimestamp > latestTimestamp) {
      return template;
    }
    if (templateTimestamp === latestTimestamp && template.id > latest.id) {
      return template;
    }
    return latest;
  }, null);
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
    const activeSenders = allSenders.filter((sender: any) => sender.active === true && sender.name && sender.email);
    const preferredDomain = await preferredSenderDomain();
    const domainMatchedSenders = preferredDomain
      ? activeSenders.filter((sender: any) => sender.email.endsWith(`@${preferredDomain}`))
      : [];
    const candidates = domainMatchedSenders.length > 0 ? domainMatchedSenders : activeSenders;
    debugLog("getDefaultSender: found", allSenders.length, "senders,", activeSenders.length, "active complete,", domainMatchedSenders.length, "matching domain", preferredDomain);
    if (candidates.length > 0) {
      const sender = candidates[0];
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
    } = await api.getSmtpTemplates();

    debugLog("findTemplateByName: searching for", templateName, "in", response.body.templates?.length || 0, "templates");
    const matchingTemplates = response.body.templates?.filter(t => t.name === templateName).map(template => ({
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
    })) || [];
    const template = newestTemplate(matchingTemplates);

    if (!template) {
      debugLog("findTemplateByName: template not found");
      return null;
    }

    debugLog("findTemplateByName: found template", template.id);
    return template;
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
  try {
    const response = await api.createSmtpTemplate(createSmtpTemplate);
    debugLog("createTemplate: created with id", response.body.id);
    return { id: response.body.id };
  } catch (error) {
    const apiError = error as any;
    const apiErrorMessage = apiError?.body?.message || apiError?.response?.body?.message;
    const apiErrorCode = apiError?.body?.code || apiError?.response?.body?.code;
    const statusCode = apiError?.statusCode || apiError?.response?.statusCode;
    debugLog("createTemplate: API error:", request.templateName, statusCode, apiErrorCode, apiErrorMessage);
    if (apiErrorMessage) {
      throw new Error(`Brevo template "${request.templateName}" create failed for sender "${request.senderEmail || "unknown"}" [${statusCode}] ${apiErrorCode}: ${apiErrorMessage}`);
    }
    throw new Error(`Brevo template "${request.templateName}" create failed for sender "${request.senderEmail || "unknown"}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteTemplate(templateId: number): Promise<void> {
  const api = await apiInstance();
  await api.deleteSmtpTemplate(templateId);
}

export async function archiveTemplate(template: MailTemplate): Promise<void> {
  try {
    await updateTemplate({
      templateId: template.id,
      templateName: backupTemplateName(template.name, template.id),
      isActive: false
    });
  } catch (error) {
    if (!invalidSenderDetailsError(error)) {
      throw error;
    }
    debugLog("archiveTemplate: deleting unarchivable broken template", template.id, template.name);
    await deleteTemplate(template.id);
  }
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
    updateSmtpTemplate.sender = { email: request.senderEmail };
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
      throw new Error(`Brevo template "${request.templateName || request.templateId}" update failed for sender "${request.senderEmail || "unknown"}" [${statusCode}] ${apiErrorCode}: ${apiErrorMessage}`);
    }
    throw new Error(`Brevo template "${request.templateName || request.templateId}" update failed for sender "${request.senderEmail || "unknown"}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function createOrUpdateTemplate(request: CreateTemplateRequest): Promise<number> {
  const existing = await findTemplateByName(request.templateName);
  const defaultSender = await getDefaultSender();

  if (!defaultSender || !defaultSender.email || !defaultSender.name) {
    throw new Error("No active sender found in Brevo account. Please configure an active sender first.");
  }

  if (existing) {
    debugLog("createOrUpdateTemplate: updating existing template", existing.id, "with sender", defaultSender.email);
    try {
      await updateTemplate({
        templateId: existing.id,
        templateName: request.templateName,
        htmlContent: request.htmlContent,
        subject: request.subject,
        isActive: request.isActive,
        senderName: defaultSender.name,
        senderEmail: defaultSender.email
      });
      return existing.id;
    } catch (error) {
      if (!invalidSenderDetailsError(error)) {
        throw error;
      }
      debugLog("createOrUpdateTemplate: archiving and recreating template after sender update failure", existing.id, request.templateName, defaultSender.email);
      await archiveTemplate(existing);
    }
  }

  debugLog("createOrUpdateTemplate: creating new template with sender", defaultSender.name, defaultSender.email);
  const created = await createTemplate({
    ...request,
    senderName: defaultSender.name,
    senderEmail: defaultSender.email
  });
  return created.id;
}
