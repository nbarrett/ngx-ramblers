import { MailConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

export interface BrevoConfigTemplateParams {
  apiKey: string;
}

export function createBrevoConfig(params: BrevoConfigTemplateParams): MailConfig {
  return {
    apiKey: params.apiKey,
    baseUrl: "https://api.brevo.com/v3",
    myBaseUrl: "",
    editorUrl: "https://app-smtp.brevo.com/templates",
    allowUpdateLists: true,
    allowSendCampaign: true,
    allowSendTransactional: true,
    listSettings: [],
    expenseNotificationConfigId: "",
    forgotPasswordNotificationConfigId: "",
    walkNotificationConfigId: "",
    contactUsNotificationConfigId: "",
    backupNotificationConfigId: ""
  };
}
