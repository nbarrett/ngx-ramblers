import { Environment } from "../env-config/environment-model";

export const DEFAULT_CHROME_VERSION = "146";

export function configuredChromeVersion(): string {
  return process.env[Environment.CHROME_VERSION] || DEFAULT_CHROME_VERSION;
}
