import { systemConfig } from "./system-config";
import { dateTimeNowAsValue } from "../shared/dates";

const cacheTtlMs = 5 * 60 * 1000;
const cache: { value: string; expiry: number } = {value: null, expiry: 0};

export async function siteBaseUrl(): Promise<string> {
  if (dateTimeNowAsValue() < cache.expiry) {
    return cache.value;
  }
  try {
    const config = await systemConfig();
    cache.value = (config?.group?.href || "").replace(/\/+$/, "") || null;
  } catch (error) {
    cache.value = null;
  }
  cache.expiry = dateTimeNowAsValue() + cacheTtlMs;
  return cache.value;
}
