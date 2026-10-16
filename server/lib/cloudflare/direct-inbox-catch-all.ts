import { EmailRoutingActionType, EmailRoutingMatcherType, SHARED_INBOX_ROUTER_WORKER_NAME } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { catchAllRule, updateCatchAllRule } from "./cloudflare-email-routing";
import { generateRouterWorkerScript, uploadWorkerScript, uploadWorkerSecret } from "./cloudflare-email-workers";

async function inboundRouterSecret(): Promise<string | null> {
  const environmentSecret = envConfig.value(Environment.NGX_INBOUND_SECRET)?.trim();
  if (environmentSecret) {
    return environmentSecret;
  } else {
    const environmentsConfig = await configuredEnvironments();
    return environmentsConfig.secrets?.[Environment.NGX_INBOUND_SECRET]?.trim() || null;
  }
}

export async function ensureDirectInboxCatchAll(cloudflareConfig: CloudflareConfig): Promise<{changed: boolean; detail: string}> {
  const secret = await inboundRouterSecret();
  if (!secret) {
    throw new Error(`No shared inbound router secret is configured (${Environment.NGX_INBOUND_SECRET})`);
  } else {
    const existing = await catchAllRule(cloudflareConfig);
    const workerName = existing?.actions?.find(action => action.type === EmailRoutingActionType.WORKER)?.value?.[0];
    const forwardTo = (existing?.actions?.find(action => action.type === EmailRoutingActionType.FORWARD)?.value?.[0] || "").trim();
    await uploadWorkerScript(cloudflareConfig, SHARED_INBOX_ROUTER_WORKER_NAME, generateRouterWorkerScript());
    await uploadWorkerSecret(cloudflareConfig, SHARED_INBOX_ROUTER_WORKER_NAME, Environment.NGX_INBOUND_SECRET, secret);
    if (forwardTo) {
      await uploadWorkerSecret(cloudflareConfig, SHARED_INBOX_ROUTER_WORKER_NAME, "NGX_FALLBACK_FORWARD", forwardTo);
    }
    if (workerName === SHARED_INBOX_ROUTER_WORKER_NAME) {
      return {changed: false, detail: "Catch-all already delivers to this site's inbox"};
    } else {
      await updateCatchAllRule(cloudflareConfig, {
        name: "Catch-all - Shared inbox router",
        enabled: true,
        matchers: [{type: EmailRoutingMatcherType.ALL}],
        actions: [{type: EmailRoutingActionType.WORKER, value: [SHARED_INBOX_ROUTER_WORKER_NAME]}]
      });
      return {changed: true, detail: "Catch-all now delivers to this site's inbox"};
    }
  }
}
