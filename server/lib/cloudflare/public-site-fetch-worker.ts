import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";
import debug from "debug";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CloudflareConfig, EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { PublicSiteFetchRelay } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { config as configModel } from "../mongo/models/config";
import { encryptEnvironmentsSecrets, environmentsEncryptionConfigured } from "../environments/environments-secrets-cipher";
import { configuredCloudflare } from "./cloudflare-config";
import { transpileWorkerTemplate, uploadWorkerScript, uploadWorkerSecret } from "./cloudflare-email-workers";
import { cloudflareApi, CloudflareResponse } from "./cloudflare.model";

const debugLog = debug(envConfig.logNamespace("public-site-fetch-worker"));
debugLog.enabled = true;

export const PUBLIC_SITE_FETCH_WORKER_NAME = "ngx-public-site-fetch";
export type { PublicSiteFetchRelay };

const ensureState: {promise: Promise<PublicSiteFetchRelay> | null} = {promise: null};
const jobRelay = new AsyncLocalStorage<PublicSiteFetchRelay>();

function cloudflareHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

async function workersDevSubdomain(cloudflareConfig: CloudflareConfig): Promise<string> {
  const response = await fetch(cloudflareApi.accountWorkersSubdomain(cloudflareConfig.accountId), {
    headers: cloudflareHeaders(cloudflareConfig.apiToken)
  });
  const data: CloudflareResponse<{subdomain: string}> = await response.json();
  if (data.success && data.result?.subdomain) {
    return data.result.subdomain;
  } else {
    const created = await fetch(cloudflareApi.accountWorkersSubdomain(cloudflareConfig.accountId), {
      method: "PUT",
      headers: cloudflareHeaders(cloudflareConfig.apiToken),
      body: JSON.stringify({subdomain: "ngx-ramblers"})
    });
    const createdData: CloudflareResponse<{subdomain: string}> = await created.json();
    if (!createdData.success || !createdData.result?.subdomain) {
      throw new Error(`Failed to read Cloudflare workers.dev subdomain: ${(createdData.errors || data.errors || []).map(item => item.message).join(", ")}`);
    } else {
      return createdData.result.subdomain;
    }
  }
}

async function enableWorkerSubdomain(cloudflareConfig: CloudflareConfig, scriptName: string): Promise<void> {
  const body = JSON.stringify({enabled: true});
  const post = await fetch(cloudflareApi.accountWorkerScriptSubdomain(cloudflareConfig.accountId, scriptName), {
    method: "POST",
    headers: cloudflareHeaders(cloudflareConfig.apiToken),
    body
  });
  const posted: CloudflareResponse<{enabled: boolean}> = await post.json();
  if (!posted.success) {
    const put = await fetch(cloudflareApi.accountWorkerScriptSubdomain(cloudflareConfig.accountId, scriptName), {
      method: "PUT",
      headers: cloudflareHeaders(cloudflareConfig.apiToken),
      body
    });
    const updated: CloudflareResponse<{enabled: boolean}> = await put.json();
    if (!updated.success) {
      throw new Error(`Failed to enable workers.dev for ${scriptName}: ${(updated.errors || posted.errors).map(item => item.message).join(", ")}`);
    }
  }
}

async function persistPublicSiteFetchSecret(secret: string): Promise<void> {
  const stored = environmentsEncryptionConfigured()
    ? encryptEnvironmentsSecrets({secrets: {[Environment.PUBLIC_SITE_FETCH_SECRET]: secret}}).secrets[Environment.PUBLIC_SITE_FETCH_SECRET]
    : secret;
  await configModel.updateOne({key: ConfigKey.ENVIRONMENTS}, {$set: {["value.secrets." + Environment.PUBLIC_SITE_FETCH_SECRET]: stored}});
}

async function publicSiteFetchSecret(): Promise<string> {
  const fromEnv = envConfig.value(Environment.PUBLIC_SITE_FETCH_SECRET)?.trim();
  if (fromEnv) {
    return fromEnv;
  } else {
    const existingDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
    const stored = (existingDoc?.value as EnvironmentsConfig)?.secrets?.[Environment.PUBLIC_SITE_FETCH_SECRET]?.trim();
    if (stored) {
      return stored;
    } else {
      const secret = randomBytes(32).toString("hex");
      await persistPublicSiteFetchSecret(secret);
      return secret;
    }
  }
}

async function createPublicSiteFetchRelay(): Promise<PublicSiteFetchRelay> {
  const cloudflareConfig = await configuredCloudflare();
  await uploadWorkerScript(cloudflareConfig, PUBLIC_SITE_FETCH_WORKER_NAME, transpileWorkerTemplate("public-site-fetch"));
  const secret = await publicSiteFetchSecret();
  await uploadWorkerSecret(cloudflareConfig, PUBLIC_SITE_FETCH_WORKER_NAME, Environment.PUBLIC_SITE_FETCH_SECRET, secret);
  await enableWorkerSubdomain(cloudflareConfig, PUBLIC_SITE_FETCH_WORKER_NAME);
  const subdomain = await workersDevSubdomain(cloudflareConfig);
  const url = `https://${PUBLIC_SITE_FETCH_WORKER_NAME}.${subdomain}.workers.dev`;
  debugLog("public site fetch relay ready at %s", url);
  return {url, secret};
}

export function resetPublicSiteFetchRelay(): void {
  ensureState.promise = null;
}

export function runWithPublicSiteFetchRelay<T>(relay: PublicSiteFetchRelay | null, work: () => Promise<T>): Promise<T> {
  if (relay?.url && relay?.secret) {
    return jobRelay.run(relay, work);
  } else {
    return work();
  }
}

export async function publicSiteFetchRelay(): Promise<PublicSiteFetchRelay> {
  const fromJob = jobRelay.getStore();
  const fromEnvUrl = envConfig.value(Environment.PUBLIC_SITE_FETCH_URL)?.trim();
  const fromEnvSecret = envConfig.value(Environment.PUBLIC_SITE_FETCH_SECRET)?.trim();
  if (fromJob?.url && fromJob?.secret) {
    return fromJob;
  } else if (fromEnvUrl && fromEnvSecret) {
    return {url: fromEnvUrl, secret: fromEnvSecret};
  } else {
    if (!ensureState.promise) {
      ensureState.promise = createPublicSiteFetchRelay().catch(error => {
        ensureState.promise = null;
        throw error;
      });
    }
    return ensureState.promise;
  }
}
