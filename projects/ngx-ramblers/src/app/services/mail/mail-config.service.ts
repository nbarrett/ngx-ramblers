import { inject, Injectable } from "@angular/core";
import { ConfigService } from "../config.service";
import { ConfigKey } from "../../models/config.model";
import { MailConfig } from "../../models/mail.model";

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
      allowUpdateLists: false,
      apiKey: null,
      allowSendCampaign: true,
      allowSendTransactional: true,
      editorUrl: "https://editor-app.brevo.com",
      baseUrl: "https://app.brevo.com",
      myBaseUrl: "https://my.brevo.com",
      listSettings: []
    });
  }

  saveConfig(config: MailConfig) {
    return this.config.saveConfig<MailConfig>(ConfigKey.BREVO, config);
  }

}
