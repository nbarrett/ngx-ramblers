import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";

import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = debug(envConfig.logNamespace("brevo-config"));
debugLog.enabled = true;

export function configuredBrevo(): Promise<MailConfig> {
  return config.queryKey(ConfigKey.BREVO)
    .then((configDocument: ConfigDocument) => {
      const brevoConfig: MailConfig = configDocument.value;
      return brevoConfig;
    });
}
