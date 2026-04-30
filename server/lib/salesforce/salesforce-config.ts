import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { SalesforceConfig } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";

const debugLog = debug(envConfig.logNamespace("salesforce-config"));
debugLog.enabled = false;

export function configuredSalesforce(): Promise<SalesforceConfig | null> {
  return config.queryKey(ConfigKey.SALESFORCE)
    .then((configDocument: ConfigDocument) => {
      const value = configDocument?.value as SalesforceConfig;
      debugLog("salesforceConfig loaded - enabled:", value?.enabled, "endpointBaseUrl:", value?.endpointBaseUrl);
      return value || null;
    });
}

export function persistSalesforceConfig(value: SalesforceConfig): Promise<ConfigDocument> {
  return config.createOrUpdateKey(ConfigKey.SALESFORCE, value);
}

export function parseGroupCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map(code => code.trim()).filter(code => code.length > 0);
}
