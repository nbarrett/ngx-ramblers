import { isString } from "es-toolkit/compat";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { stripTrailingSlash } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "./system-config";
import { dateTimeNowAsValue } from "../shared/dates";

const cacheTtlMs = 5 * 60 * 1000;
const cache: { value: string; expiry: number } = {value: null, expiry: 0};

function baseUrlFromEnvironment(): string | null {
  const fromEnvironment = envConfig.value(Environment.BASE_URL);
  return isString(fromEnvironment) && fromEnvironment.trim() ? stripTrailingSlash(fromEnvironment.trim()) : null;
}

async function baseUrlFromSystemConfig(): Promise<string | null> {
  try {
    const config = await systemConfig();
    return stripTrailingSlash((config?.group?.href || "").trim()) || null;
  } catch (error) {
    return null;
  }
}

export async function siteBaseUrl(): Promise<string> {
  if (dateTimeNowAsValue() >= cache.expiry) {
    cache.value = await baseUrlFromSystemConfig() || baseUrlFromEnvironment();
    cache.expiry = dateTimeNowAsValue() + cacheTtlMs;
  }
  return cache.value;
}
