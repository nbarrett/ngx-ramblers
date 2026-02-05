import { BREVO_DEFAULTS, MailConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

export interface BrevoConfigTemplateParams {
  apiKey: string;
}

export function createBrevoConfig(params: BrevoConfigTemplateParams): MailConfig {
  return {
    apiKey: params.apiKey,
    baseUrl: BREVO_DEFAULTS.BASE_URL,
    myBaseUrl: BREVO_DEFAULTS.MY_BASE_URL,
    editorUrl: BREVO_DEFAULTS.EDITOR_URL,
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
