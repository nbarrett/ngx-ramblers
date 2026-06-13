import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";

import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { BrevoClient } from "@getbrevo/brevo";

export function configuredBrevo(): Promise<MailConfig> {
  return config.queryKey(ConfigKey.BREVO)
    .then((configDocument: ConfigDocument) => {
      const brevoConfig: MailConfig = configDocument.value;
      return brevoConfig;
    });
}

export async function brevoClient(): Promise<BrevoClient> {
  const brevoConfig: MailConfig = await configuredBrevo();
  return new BrevoClient({apiKey: brevoConfig.apiKey});
}
