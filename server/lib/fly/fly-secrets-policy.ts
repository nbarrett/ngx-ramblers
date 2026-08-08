import { keys, toPairs } from "es-toolkit/compat";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";

export const SITE_FLY_SECRET_ALLOWLIST: readonly string[] = [
  Environment.AUTH_SECRET,
  Environment.AWS_ACCESS_KEY_ID,
  Environment.AWS_SECRET_ACCESS_KEY,
  Environment.AWS_REGION,
  Environment.AWS_BUCKET,
  Environment.MONGODB_URI,
  Environment.NODE_ENV,
  Environment.NGX_LITE,
  Environment.PLATFORM_ADMIN_ENABLED,
  Environment.ENVIRONMENT_SETUP_API_KEY,
  Environment.CLOUDFLARE_CONFIG,
  Environment.FLY_CONFIG,
  Environment.NGX_INBOUND_SECRET,
  Environment.INTEGRATION_WORKER_URL,
  Environment.INTEGRATION_WORKER_SHARED_SECRET,
  Environment.INTEGRATION_WORKER_ENCRYPTION_KEY,
  Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL,
  Environment.INTEGRATION_WORKER_CALLBACK_SECRET,
  Environment.CHROME_VERSION,
  Environment.AI_ENABLED,
  Environment.AI_PROVIDER,
  Environment.AI_BASE_URL,
  Environment.AI_MODEL,
  Environment.AI_API_KEY,
  Environment.BASE_URL,
  Environment.DEBUG,
  Environment.DEBUG_COLORS,
  Environment.SKIP_MIGRATIONS_ON_STARTUP,
  Environment.MEMORY_WATCHDOG_ENABLED,
  Environment.MEMORY_WATCHDOG_INTERVAL_MS,
  Environment.MEMORY_WATCHDOG_MACHINE_PERCENT,
  Environment.MEMORY_WATCHDOG_HEAP_PERCENT,
  Environment.MEMORY_WATCHDOG_RSS_MB,
  Environment.MEMORY_WATCHDOG_LOOP_LAG_MS,
  Environment.MEMORY_WATCHDOG_TRIPS,
  "NODE_OPTIONS"
];

export const SITE_FLY_SECRET_ALLOWLIST_SET = new Set(SITE_FLY_SECRET_ALLOWLIST);

export const KNOWN_LEGACY_SITE_FLY_SECRETS: readonly string[] = [
  "GOOGLE_MAPS_APIKEY",
  "OS_MAPS_API_KEY",
  "RECAPTCHA_SITE_KEY",
  "RECAPTCHA_SECRET_KEY",
  "BREVO_API_KEY",
  "MEETUP_ACCESS_TOKEN",
  "RAMBLERS_API_KEY",
  "RAMBLERS_AREA_CODE",
  "RAMBLERS_AREA_NAME",
  "RAMBLERS_GROUP_CODE",
  "RAMBLERS_GROUP_NAME",
  "RAMBLERS_UPLOAD_WORKER_URL",
  "RAMBLERS_UPLOAD_WORKER_SHARED_SECRET",
  "RAMBLERS_UPLOAD_WORKER_ENCRYPTION_KEY",
  "RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL",
  "DOCKER_USERNAME",
  "DOCKER_PASSWORD",
  "CHROMEDRIVER_PATH",
  "CHROMEDRIVER_VERSION",
  "GOOGLE_CHROME_BIN",
  "PAPERTRAIL_API_TOKEN",
  "WALKS_NPM_COMMAND",
  "ALLOWED_DOMAINS",
  "PORT",
  "ENVIRONMENT_SETUP_ENABLED",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_PAT",
  "WEBDRIVER_FRAMEWORK",
  "HEADLESS",
  "NGX_INBOUND_ROUTER_SECRET",
  "RUN_MIGRATIONS_ON_STARTUP",
  "CMS_USERNAME",
  "CMS_PASSWORD",
  "CMS_URL"
];

export function isAllowedSiteFlySecret(key: string): boolean {
  return SITE_FLY_SECRET_ALLOWLIST_SET.has(key);
}

export function filterSecretsForSiteFlyDeploy(secrets: Record<string, string>): Record<string, string> {
  return toPairs(secrets).reduce((accumulator, [key, value]) => {
    if (isAllowedSiteFlySecret(key) && value) {
      return {...accumulator, [key]: value};
    } else {
      return accumulator;
    }
  }, {} as Record<string, string>);
}

export function disallowedSiteFlySecrets(secretNames: string[]): string[] {
  return secretNames.filter(name => !isAllowedSiteFlySecret(name)).sort();
}

export function legacySiteFlySecretsPresent(secretNames: string[]): string[] {
  const known = new Set(KNOWN_LEGACY_SITE_FLY_SECRETS);
  return secretNames.filter(name => known.has(name) || !isAllowedSiteFlySecret(name)).sort();
}

export function secretKeys(secrets: Record<string, string>): string[] {
  return keys(secrets).sort();
}
