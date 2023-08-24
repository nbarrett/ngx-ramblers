import mailchimp from "@mailchimp/mailchimp_marketing";
import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { MailchimpConfig } from "../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import * as transforms from "../mongo/controllers/transforms";
import { MailchimpConfigData } from "../shared/server-models";

const debugLog = debug(envConfig.logNamespace("mailchimp-config"));

export function configuredMailchimp(): Promise<MailchimpConfigData> {
  return config.queryKey(ConfigKey.MAILCHIMP)
    .then((mailchimpConfigDocument: ConfigDocument) => {
      const mailchimpConfigParameters: MailchimpConfig = mailchimpConfigDocument.value;
      mailchimp.setConfig({
        apiKey: mailchimpConfigParameters.apiKey,
        server: resolvePrefix(mailchimpConfigParameters),
      });
      return {config: mailchimpConfigParameters, client: mailchimp} as unknown as MailchimpConfigData;
    })
    .catch(error => {
      debugLog("Error", transforms.parseError(error));
      throw error;
    });
}

function resolvePrefix(mailchimpConfig: MailchimpConfig): string {
  const url = new URL(mailchimpConfig.apiUrl);
  return url.host.split("\.")[0];
}

