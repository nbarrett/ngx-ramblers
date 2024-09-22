import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Meetup, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("meetup-config"));
debugLog.enabled = false;

export async function configuredMeetup(): Promise<Meetup> {
  const config: SystemConfig = await systemConfig();
  return config?.externalSystems?.meetup;
}
