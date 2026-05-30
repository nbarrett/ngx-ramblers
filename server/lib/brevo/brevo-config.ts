import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";

import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";

export function configuredBrevo(): Promise<MailConfig> {
  return config.queryKey(ConfigKey.BREVO)
    .then((configDocument: ConfigDocument) => {
      const brevoConfig: MailConfig = configDocument.value;
      return brevoConfig;
    });
}
