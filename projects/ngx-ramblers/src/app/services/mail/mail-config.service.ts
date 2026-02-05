import { inject, Injectable } from "@angular/core";
import { ConfigService } from "../config.service";
import { ConfigKey } from "../../models/config.model";
import { BREVO_DEFAULTS, MailConfig } from "../../models/mail.model";

@Injectable({
  providedIn: "root"
})
export class MailConfigService {

  private config = inject(ConfigService);


  async queryConfig(): Promise<MailConfig> {
    return await this.config.queryConfig<MailConfig>(ConfigKey.BREVO, {
      contactUsNotificationConfigId: null,
      expenseNotificationConfigId: null,
      forgotPasswordNotificationConfigId: null,
      walkNotificationConfigId: null,
      backupNotificationConfigId: null,
      allowUpdateLists: false,
      apiKey: null,
      allowSendCampaign: true,
      allowSendTransactional: true,
      editorUrl: BREVO_DEFAULTS.EDITOR_URL,
      baseUrl: BREVO_DEFAULTS.BASE_URL,
      myBaseUrl: BREVO_DEFAULTS.MY_BASE_URL,
      listSettings: []
    });
  }

  saveConfig(config: MailConfig) {
    return this.config.saveConfig<MailConfig>(ConfigKey.BREVO, config);
  }

}
