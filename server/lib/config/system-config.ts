import debug from "debug";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debugLog = debug(envConfig.logNamespace("system-config"));
debugLog.enabled = false;

export async function systemConfig(): Promise<SystemConfig> {
  return (await config.queryKey(ConfigKey.SYSTEM))?.value;
}
