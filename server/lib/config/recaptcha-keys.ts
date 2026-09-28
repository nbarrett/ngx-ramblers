import debug from "debug";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { RecaptchaConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { systemConfig } from "./system-config";

const debugLog = debug(envConfig.logNamespace("recaptcha-keys"));
debugLog.enabled = false;

export function recaptchaFromEnvironmentsConfig(environments: EnvironmentsConfig): RecaptchaConfig {
  return {
    siteKey: environments.secrets?.RECAPTCHA_SITE_KEY || "",
    secretKey: environments.secrets?.RECAPTCHA_SECRET_KEY || ""
  };
}

export async function recaptchaFromGlobalConfig(): Promise<RecaptchaConfig> {
  try {
    return recaptchaFromEnvironmentsConfig(await configuredEnvironments());
  } catch (error) {
    debugLog("global recaptcha not available: %s", error.message);
    return {siteKey: "", secretKey: ""};
  }
}

export async function recaptchaKeys(): Promise<RecaptchaConfig> {
  const local = (await systemConfig())?.recaptcha;
  const fromGlobal = await recaptchaFromGlobalConfig();
  return {
    siteKey: local?.siteKey || fromGlobal.siteKey || "",
    secretKey: local?.secretKey || fromGlobal.secretKey || ""
  };
}
