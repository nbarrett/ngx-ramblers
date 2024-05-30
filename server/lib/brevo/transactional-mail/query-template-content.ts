import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { GetSmtpTemplateOverview } from "@getbrevo/brevo";
import * as http from "http";
import { TemplateResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { MailTemplateResponse } from "../../../../projects/ngx-ramblers/src/app/models/brevo.model";

const messageType = "brevo:query-template-content";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

export async function queryTemplateContent(templateId: number): Promise<TemplateResponse> {

  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
  return apiInstance.getSmtpTemplate(templateId).then((data: {
    response: http.IncomingMessage;
    body: GetSmtpTemplateOverview
  }) => {
    const x: MailTemplateResponse = null;
    debugLog("API called successfully. Returned data", JSON.stringify(data));
    return {
      createdAt: data.body?.createdAt,
      doiTemplate: data.body?.doiTemplate,
      htmlContent: data.body?.htmlContent,
      id: data.body?.id,
      isActive: data.body?.isActive,
      modifiedAt: data.body?.modifiedAt,
      name: data.body?.name,
      replyTo: data.body?.replyTo,
      sender: {name: data.body?.sender?.name, id: +data.body?.sender?.id, email: data.body?.sender?.email},
      subject: data.body?.subject,
      tag: data.body?.tag,
      testSent: data.body?.testSent,
      toField: data.body?.toField
    };
  }).catch((error: any) => {
    debugLog("error", error);
    return null;
  });
}

