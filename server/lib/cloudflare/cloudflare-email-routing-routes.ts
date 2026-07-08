import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import * as authConfig from "../auth/auth-config";
import { configuredCloudflare, nonSensitiveCloudflareConfig } from "./cloudflare-config";
import {
  catchAllRule,
  createEmailRoutingRule,
  deleteEmailRoutingRule,
  listEmailRoutingRules,
  updateCatchAllRule,
  updateEmailRoutingRule
} from "./cloudflare-email-routing";
import { createDnsRecord, deleteDnsRecord, listDnsRecords, zoneForHostname } from "./cloudflare-dns";
import { DnsRecordResult, DnsRecordType, MxRecordStatus } from "./cloudflare.model";
import {
  ensureEmailAuthRecords,
  queryEmailAuthStatus
} from "./cloudflare-email-auth-records";
import {
  createDestinationAddress,
  deleteDestinationAddress,
  listDestinationAddresses
} from "./cloudflare-destination-addresses";
import {
  deleteWorkerScript,
  fetchWorkerScriptContent,
  firstDifference,
  generateRouterWorkerScript,
  generateWorkerScript,
  listWorkerScripts,
  parseRecipientsFromScript,
  parseWorkerScriptInfo,
  ROUTER_WORKER_NAME,
  scriptsMatchIgnoringWhitespace,
  uploadWorkerScript,
  uploadWorkerSecret,
  workerScriptName
} from "./cloudflare-email-workers";
import { ensureInboundInboxWebhookConfigured, ensureInboundWebhookConfigured } from "../brevo/inbound-webhook-config";
import { configuredBrevo } from "../brevo/brevo-config";
import { handleInboundMime } from "./inbound-mime-handler";
import { handleInboundInbox } from "./inbound-inbox-handler";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { asyncRoute } from "../shared/async-route";
import { HttpError } from "../shared/http-error";
import { queryEmailRoutingLogs, queryWorkerInvocationLogs } from "./cloudflare-analytics";
import {
  CatchAllAction,
  CreateOrUpdateEmailRouteRequest,
  CreateOrUpdateWorkerRequest,
  EmailForwardingMode,
  EmailRoutingLogsRequest,
  EmailRoutingMatcherType,
  EmailRoutingMatcherField,
  EmailRoutingActionType,
  UpdateCatchAllRequest,
  WorkerLogsRequest
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { configuredEnvironments } from "../environments/environments-config";

const messageType = "cloudflare:email-routing";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

const BREVO_SMTP_REQUIRED_MESSAGE = "Brevo re-send (authenticated) needs SMTP credentials before it can deliver messages. Open Mail Settings > Mail API Settings and set both SMTP Login and SMTP Key, then come back and deploy the worker.";

async function brevoSmtpCredentialsMissing(): Promise<boolean> {
  try {
    const brevo = await configuredBrevo();
    return !brevo.smtpUser?.trim() || !brevo.smtpPassword?.trim();
  } catch (error) {
    errorDebugLog("Failed to read Brevo config when checking SMTP credentials:", (error as Error).message);
    return true;
  }
}

async function webhookContextForMode(mode: EmailForwardingMode): Promise<{ webhookUrl: string; secret: string } | null> {
  if (mode === EmailForwardingMode.BREVO_RESEND) {
    return ensureInboundWebhookConfigured();
  }
  if (mode === EmailForwardingMode.NGX_INBOX) {
    return ensureInboundInboxWebhookConfigured();
  }
  return null;
}

function forwardingModeLabel(mode: EmailForwardingMode): string {
  if (mode === EmailForwardingMode.BREVO_RESEND) {
    return "Brevo re-send";
  }
  if (mode === EmailForwardingMode.NGX_INBOX) {
    return "Direct to inbox";
  }
  return "Worker forward";
}

const router = express.Router();

router.get("/config", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const config = await nonSensitiveCloudflareConfig();
  const host = (config.baseDomain || "").replace(/^www\./, "").trim().toLowerCase();
  if (config.configured && host) {
    try {
      const cloudflareConfig = await configuredCloudflare();
      const zone = await zoneForHostname(cloudflareConfig.apiToken, host);
      const zoneName = (zone?.name || "").trim().toLowerCase();
      config.zoneName = zoneName || undefined;
      config.ownsZone = zoneName ? host === zoneName : undefined;
    } catch (zoneError) {
      debugLog("Could not resolve zone ownership for %s: %s", host, (zoneError as Error).message);
    }
  }
  res.json({request: {messageType}, response: config});
}));

router.get("/rules", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const rules = await listEmailRoutingRules(cloudflareConfig);
  res.json({request: {messageType}, response: rules});
}));

router.get("/rules/catch-all", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const rule = await catchAllRule(cloudflareConfig);
  res.json({request: {messageType}, response: rule});
}));

interface CatchAllRulePlan {
  enabled: boolean;
  actions: { type: EmailRoutingActionType; value: string[] }[];
  nameSuffix: string;
}

async function ensureForwardDestinationVerified(cloudflareConfig: CloudflareConfig, email: string): Promise<void> {
  const normalisedEmail = email.trim().toLowerCase();
  const existing = (await listDestinationAddresses(cloudflareConfig))
    .find(a => a.email?.trim().toLowerCase() === normalisedEmail);
  if (existing?.verified) {
    return;
  }
  if (existing) {
    throw new HttpError(400, `${email} is registered as a Cloudflare destination but has not been verified yet. Open the verification email Cloudflare sent to ${email}, click the link, then try again.`, "DestinationNotVerified");
  }
  try {
    await createDestinationAddress(cloudflareConfig, email);
  } catch (error) {
    if (/verification email has been sent too recently/i.test(error.message || "")) {
      throw new HttpError(429, `Cloudflare recently sent a verification email to ${email}. Check that inbox for the link, then try again in a few minutes.`, "RateLimited");
    }
    throw new HttpError(400, `Could not register ${email} as a Cloudflare destination address: ${error.message}`, "DestinationRegistrationFailed");
  }
  throw new HttpError(400, `A verification email has been sent to ${email}. Click the link Cloudflare sent to that inbox, then try again.`, "DestinationVerificationSent");
}

async function planCatchAllRule(
  action: CatchAllAction,
  destinations: string[],
  forwardingMode: EmailForwardingMode,
  cloudflareConfig: CloudflareConfig,
  catchAllScriptName: string,
  baseDomain: string
): Promise<CatchAllRulePlan> {
  if (action === CatchAllAction.DISABLED) {
    return {
      enabled: false,
      actions: [{type: EmailRoutingActionType.DROP, value: []}],
      nameSuffix: "Disabled"
    };
  }
  if (action === CatchAllAction.DROP) {
    return {
      enabled: true,
      actions: [{type: EmailRoutingActionType.DROP, value: []}],
      nameSuffix: "Drop"
    };
  }
  if (action === CatchAllAction.FORWARD) {
    if (destinations.length !== 1) {
      throw new HttpError(400, "FORWARD action requires exactly one destination");
    }
    await ensureForwardDestinationVerified(cloudflareConfig, destinations[0]);
    return {
      enabled: true,
      actions: [{type: EmailRoutingActionType.FORWARD, value: [destinations[0]]}],
      nameSuffix: `Forward to ${destinations[0]}`
    };
  }
  if (action === CatchAllAction.SHARED_ROUTER) {
    if (destinations.length !== 1) {
      throw new HttpError(400, "SHARED_ROUTER action requires exactly one fallback forward destination (where non-inbox mail goes).");
    }
    await ensureForwardDestinationVerified(cloudflareConfig, destinations[0]);
    const scriptName = await ensureRouterWorker(cloudflareConfig);
    await uploadWorkerSecret(cloudflareConfig, scriptName, "NGX_FALLBACK_FORWARD", destinations[0]);
    return {
      enabled: true,
      actions: [{type: EmailRoutingActionType.WORKER, value: [scriptName]}],
      nameSuffix: `Shared inbox router (fallback ${destinations[0]})`
    };
  }
  if (action === CatchAllAction.WORKER) {
    if (forwardingMode !== EmailForwardingMode.NGX_INBOX && destinations.length === 0) {
      throw new HttpError(400, "WORKER action requires at least one destination");
    }
    if (forwardingMode === EmailForwardingMode.BREVO_RESEND && await brevoSmtpCredentialsMissing()) {
      throw new HttpError(400, BREVO_SMTP_REQUIRED_MESSAGE);
    }
    const webhookContext = await webhookContextForMode(forwardingMode);
    const scriptContent = generateWorkerScript(destinations, forwardingMode, {
      roleEmail: `*@${baseDomain}`,
      roleName: "catch-all",
      webhookUrl: webhookContext?.webhookUrl
    });
    await uploadWorkerScript(cloudflareConfig, catchAllScriptName, scriptContent);
    if (webhookContext?.secret) {
      await uploadWorkerSecret(cloudflareConfig, catchAllScriptName, "NGX_INBOUND_SECRET", webhookContext.secret);
    }
    const modeLabel = forwardingModeLabel(forwardingMode);
    return {
      enabled: true,
      actions: [{type: EmailRoutingActionType.WORKER, value: [catchAllScriptName]}],
      nameSuffix: forwardingMode === EmailForwardingMode.NGX_INBOX ? modeLabel : `${modeLabel} (${destinations.length} recipients)`
    };
  }
  throw new HttpError(400, `Unknown catch-all action: ${action}`);
}

async function assertCatchAllOwnedByThisSite(cloudflareConfig: CloudflareConfig, baseDomain: string): Promise<void> {
  const host = (baseDomain || "").replace(/^www\./, "").trim().toLowerCase();
  if (!host) {
    return;
  }
  const zone = await zoneForHostname(cloudflareConfig.apiToken, host);
  const zoneName = (zone?.name || "").trim().toLowerCase();
  if (zoneName && host !== zoneName && host.endsWith(`.${zoneName}`)) {
    throw new HttpError(403,
      `The catch-all belongs to the ${zoneName} Cloudflare zone, which is shared by every site on that domain (including staging). This site (${host}) is a subdomain of it, so changing the catch-all here would affect the whole zone and every other site on it. Manage the catch-all from the ${zoneName} site instead.`,
      "SubdomainCatchAllForbidden");
  }
}

router.put("/rules/catch-all", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const nsConfig = await nonSensitiveCloudflareConfig();
  await assertCatchAllOwnedByThisSite(cloudflareConfig, nsConfig.baseDomain || "");
  const request: UpdateCatchAllRequest = req.body;
  const destinations = (request.destinations || []).map(d => String(d || "").trim()).filter(Boolean);
  const existingRule = await catchAllRule(cloudflareConfig);
  const existingWorkerScript = existingRule?.actions?.find(a => a.type === EmailRoutingActionType.WORKER)?.value?.[0];
  const sanitisedDomain = nsConfig.baseDomain?.replace(/\./g, "-") || "";
  const catchAllScriptName = `email-fwd-${sanitisedDomain}-catch-all`;
  const forwardingMode = request.forwardingMode || EmailForwardingMode.CLOUDFLARE_FORWARD;

  const plan = await planCatchAllRule(request.action, destinations, forwardingMode, cloudflareConfig, catchAllScriptName, nsConfig.baseDomain || "");

  const updated = await updateCatchAllRule(cloudflareConfig, {
    name: `Catch-all - ${plan.nameSuffix}`,
    enabled: plan.enabled,
    matchers: [{type: EmailRoutingMatcherType.ALL}],
    actions: plan.actions
  });

  const previousIsDedicatedCatchAllScript = existingWorkerScript?.endsWith("-catch-all");
  const previousIsOrphaned = existingWorkerScript
    && (request.action !== CatchAllAction.WORKER || existingWorkerScript !== catchAllScriptName);
  if (previousIsOrphaned && previousIsDedicatedCatchAllScript) {
    try {
      await deleteWorkerScript(cloudflareConfig, existingWorkerScript);
    } catch (cleanupError) {
      errorDebugLog("Failed to delete previous catch-all worker script", existingWorkerScript, ":", cleanupError.message);
    }
  } else if (previousIsOrphaned) {
    debugLog("Catch-all previously referenced %s - preserving (shared with another rule, not a dedicated catch-all script). The new catch-all rule points at %s.", existingWorkerScript, catchAllScriptName);
  }

  res.json({request: {messageType}, response: updated});
}));

router.post("/rules/catch-all/router/redeploy", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const nsConfig = await nonSensitiveCloudflareConfig();
  await assertCatchAllOwnedByThisSite(cloudflareConfig, nsConfig.baseDomain || "");
  const scriptName = await ensureRouterWorker(cloudflareConfig);
  res.json({request: {messageType}, response: {scriptName}});
}));

async function inboundRouterSecret(): Promise<string | null> {
  const environmentSecret = envConfig.value(Environment.NGX_INBOUND_ROUTER_SECRET)?.trim();
  if (environmentSecret) {
    return environmentSecret;
  }
  const environmentsConfig = await configuredEnvironments();
  return environmentsConfig.secrets?.[Environment.NGX_INBOUND_ROUTER_SECRET]?.trim() || null;
}

async function ensureRouterWorker(cloudflareConfig: CloudflareConfig): Promise<string> {
  const secret = await inboundRouterSecret();
  if (!secret) {
    throw new HttpError(400, "No shared inbound router secret is configured (NGX_INBOUND_ROUTER_SECRET). Set it in the platform admin shared secrets and redeploy this site before routing mail to inboxes.", "RouterSecretMissing");
  }
  await uploadWorkerScript(cloudflareConfig, ROUTER_WORKER_NAME, generateRouterWorkerScript());
  await uploadWorkerSecret(cloudflareConfig, ROUTER_WORKER_NAME, "NGX_INBOUND_SECRET", secret);
  return ROUTER_WORKER_NAME;
}

function literalMatcherValue(rule: { matchers?: { type: EmailRoutingMatcherType; field?: EmailRoutingMatcherField; value?: string }[] }): string | undefined {
  return rule.matchers?.find(m => m.type === EmailRoutingMatcherType.LITERAL)?.value;
}

router.post("/route-to-inbox", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const nsConfig = await nonSensitiveCloudflareConfig();
  const baseDomain = (nsConfig.baseDomain || "").trim().toLowerCase();
  if (!baseDomain) {
    throw new HttpError(400, "Cloudflare baseDomain not available for this site.");
  }
  const scriptName = await ensureRouterWorker(cloudflareConfig);
  const rules = await listEmailRoutingRules(cloudflareConfig);
  const siteRules = rules.filter(rule => Boolean(rule.id) && rule.matchers?.some(m =>
    m.type === EmailRoutingMatcherType.LITERAL
    && m.field === EmailRoutingMatcherField.TO
    && (m.value || "").trim().toLowerCase().endsWith(`@${baseDomain}`)));
  await Promise.all(siteRules.map(rule => updateEmailRoutingRule(cloudflareConfig, rule.id, {
    name: `Inbox ${literalMatcherValue(rule) || ""}`.slice(0, 100),
    enabled: true,
    matchers: rule.matchers,
    actions: [{type: EmailRoutingActionType.WORKER, value: [scriptName]}]
  })));
  const routed = siteRules.map(literalMatcherValue).filter(Boolean);
  debugLog("Routed %d address(es) for %s to the inbox router: %o", routed.length, baseDomain, routed);
  res.json({request: {messageType}, response: {scriptName, routed}});
}));

router.post("/rules", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const request: CreateOrUpdateEmailRouteRequest = req.body;
  await ensureForwardDestinationVerified(cloudflareConfig, request.destinationEmail);
  const rule = await createEmailRoutingRule(cloudflareConfig, {
    name: `Forward ${request.roleName} to ${request.destinationEmail}`,
    enabled: request.enabled,
    matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: request.roleEmail}],
    actions: [{type: EmailRoutingActionType.FORWARD, value: [request.destinationEmail]}]
  });
  res.json({request: {messageType}, response: rule});
}));

router.put("/rules/:ruleId", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const request: CreateOrUpdateEmailRouteRequest = req.body;
  await ensureForwardDestinationVerified(cloudflareConfig, request.destinationEmail);
  const rule = await updateEmailRoutingRule(cloudflareConfig, req.params.ruleId, {
    name: `Forward ${request.roleName} to ${request.destinationEmail}`,
    enabled: request.enabled,
    matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: request.roleEmail}],
    actions: [{type: EmailRoutingActionType.FORWARD, value: [request.destinationEmail]}]
  });
  res.json({request: {messageType}, response: rule});
}));

router.delete("/rules/:ruleId", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  await deleteEmailRoutingRule(cloudflareConfig, req.params.ruleId);
  res.json({request: {messageType}, response: {deleted: true}});
}));

router.get("/destination-addresses", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  debugLog("GET /destination-addresses");
  const cloudflareConfig = await configuredCloudflare();
  const addresses = await listDestinationAddresses(cloudflareConfig);
  debugLog("GET /destination-addresses returned %d addresses", addresses.length);
  res.json({request: {messageType}, response: addresses});
}));

router.post("/destination-addresses", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const {email} = req.body;
  const normalisedEmail = String(email || "").trim().toLowerCase();
  const existing = (await listDestinationAddresses(cloudflareConfig))
    .find(a => a.email?.trim().toLowerCase() === normalisedEmail);
  if (existing) {
    debugLog("Destination address %s already exists (id=%s, verified=%s) - skipping create", normalisedEmail, existing.id, Boolean(existing.verified));
    res.json({request: {messageType}, response: existing});
    return;
  }
  try {
    const address = await createDestinationAddress(cloudflareConfig, email);
    res.json({request: {messageType}, response: address});
  } catch (error) {
    if (/verification email has been sent too recently/i.test(error.message || "")) {
      throw new HttpError(429, "Cloudflare sent a verification email to this address too recently. Ask the recipient to check their inbox for the verification link, then try again in a few minutes.", "RateLimited");
    }
    throw error;
  }
}));

router.post("/destination-addresses/resend", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const normalisedEmail = String(req.body?.email || "").trim().toLowerCase();
  if (!normalisedEmail) {
    throw new HttpError(400, "email is required");
  }
  const existing = (await listDestinationAddresses(cloudflareConfig))
    .find(a => a.email?.trim().toLowerCase() === normalisedEmail);
  if (existing?.verified) {
    debugLog("Destination address %s already verified - nothing to resend", normalisedEmail);
    res.json({request: {messageType}, response: existing});
    return;
  }
  if (existing) {
    debugLog("Removing unverified destination address %s (id=%s) before re-issuing verification", normalisedEmail, existing.id);
    await deleteDestinationAddress(cloudflareConfig, existing.id);
  }
  try {
    const address = await createDestinationAddress(cloudflareConfig, normalisedEmail);
    res.json({request: {messageType}, response: address});
  } catch (error) {
    if (/verification email has been sent too recently/i.test(error.message || "")) {
      throw new HttpError(429, `Cloudflare sent a verification email to ${normalisedEmail} too recently. Check that inbox for the link, then try again in a few minutes.`, "RateLimited");
    }
    throw error;
  }
}));

router.delete("/destination-addresses/:addressId", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  await deleteDestinationAddress(cloudflareConfig, req.params.addressId);
  res.json({request: {messageType}, response: {deleted: true}});
}));

router.get("/workers", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const nsConfig = await nonSensitiveCloudflareConfig();
  const sanitisedDomain = nsConfig.baseDomain?.replace(/\./g, "-") || "";
  const prefix = `email-fwd-${sanitisedDomain}`;
  const allScripts = await listWorkerScripts(cloudflareConfig);
  const filtered = allScripts.filter(s => s.id?.startsWith(prefix));
  res.json({request: {messageType}, response: filtered});
}));

router.get("/workers/:scriptName/recipients", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const scriptContent = await fetchWorkerScriptContent(cloudflareConfig, req.params.scriptName);
  const recipients = parseRecipientsFromScript(scriptContent);
  res.json({request: {messageType}, response: recipients});
}));

router.get("/workers/:scriptName/info", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const scriptContent = await fetchWorkerScriptContent(cloudflareConfig, req.params.scriptName);
  const info = parseWorkerScriptInfo(scriptContent);

  let upToDate: boolean | undefined;
  const roleEmail = req.query.roleEmail as string | undefined;
  const roleName = req.query.roleName as string | undefined;
  const isRouterCatchAllContext = req.params.scriptName === ROUTER_WORKER_NAME
    && (roleName === "catch-all" || (roleEmail || "").trim().startsWith("*@"));
  if (isRouterCatchAllContext) {
    const expected = generateRouterWorkerScript();
    upToDate = scriptsMatchIgnoringWhitespace(expected, scriptContent);
    if (!upToDate) {
      const diff = firstDifference(expected, scriptContent);
      debugLog("Router worker out of sync for %s. First diff at idx %d\n  expected[..]: %s\n  deployed[..]: %s",
        req.params.scriptName, diff?.index, diff?.aAround, diff?.bAround);
    }
  } else if (roleEmail) {
    const webhookContext = await webhookContextForMode(info.forwardingMode);
    const expected = generateWorkerScript(info.recipients, info.forwardingMode, {
      roleEmail,
      roleName: roleName || "",
      webhookUrl: webhookContext?.webhookUrl
    });
    upToDate = scriptsMatchIgnoringWhitespace(expected, scriptContent);
    if (!upToDate) {
      const diff = firstDifference(expected, scriptContent);
      debugLog("Worker out of sync for %s. First diff at idx %d\n  expected[..]: %s\n  deployed[..]: %s",
        req.params.scriptName, diff?.index, diff?.aAround, diff?.bAround);
    }
  }

  res.json({request: {messageType}, response: {...info, upToDate}});
}));

router.post("/workers", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const nsConfig = await nonSensitiveCloudflareConfig();
  const request: CreateOrUpdateWorkerRequest = req.body;
  const forwardingMode = request.forwardingMode || EmailForwardingMode.CLOUDFLARE_FORWARD;
  const scriptName = workerScriptName(nsConfig.baseDomain, request.roleType);

  if (forwardingMode === EmailForwardingMode.BREVO_RESEND && await brevoSmtpCredentialsMissing()) {
    throw new HttpError(400, BREVO_SMTP_REQUIRED_MESSAGE);
  }
  const webhookContext = await webhookContextForMode(forwardingMode);

  const scriptContent = generateWorkerScript(request.recipients, forwardingMode, {
    roleEmail: request.roleEmail,
    roleName: request.roleName,
    webhookUrl: webhookContext?.webhookUrl
  });

  await uploadWorkerScript(cloudflareConfig, scriptName, scriptContent);

  if (webhookContext?.secret) {
    await uploadWorkerSecret(cloudflareConfig, scriptName, "NGX_INBOUND_SECRET", webhookContext.secret);
  }

  const rules = await listEmailRoutingRules(cloudflareConfig);
  const existingRule = rules.find(rule =>
    rule.matchers?.some(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO && m.value === request.roleEmail)
  );

  const modeLabel = forwardingModeLabel(forwardingMode);
  const workerRule = {
    name: `${modeLabel} ${request.roleName} (${request.recipients.length} recipients)`,
    enabled: request.enabled,
    matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: request.roleEmail}],
    actions: [{type: EmailRoutingActionType.WORKER, value: [scriptName]}]
  };

  if (existingRule) {
    await updateEmailRoutingRule(cloudflareConfig, existingRule.id, workerRule);
  } else {
    await createEmailRoutingRule(cloudflareConfig, workerRule);
  }

  res.json({request: {messageType}, response: {scriptName, recipients: request.recipients, forwardingMode}});
}));

router.delete("/workers/:scriptName", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const scriptName = req.params.scriptName;

  await deleteWorkerScript(cloudflareConfig, scriptName);

  const rules = await listEmailRoutingRules(cloudflareConfig);
  const workerRule = rules.find(rule =>
    rule.actions?.some(a => a.type === EmailRoutingActionType.WORKER && a.value?.includes(scriptName))
  );
  if (workerRule) {
    await deleteEmailRoutingRule(cloudflareConfig, workerRule.id);
  }

  res.json({request: {messageType}, response: {deleted: true, scriptName}});
}));

router.put("/workers/:oldName/rename", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const cloudflareConfig = await configuredCloudflare();
  const oldName = req.params.oldName;
  const {newScriptName} = req.body;

  const oldContent = await fetchWorkerScriptContent(cloudflareConfig, oldName);
  await uploadWorkerScript(cloudflareConfig, newScriptName, oldContent);

  const rules = await listEmailRoutingRules(cloudflareConfig);
  const workerRule = rules.find(rule =>
    rule.actions?.some(a => a.type === EmailRoutingActionType.WORKER && a.value?.includes(oldName))
  );
  if (workerRule) {
    await updateEmailRoutingRule(cloudflareConfig, workerRule.id, {
      ...workerRule,
      actions: [{type: EmailRoutingActionType.WORKER, value: [newScriptName]}]
    });
  }

  await deleteWorkerScript(cloudflareConfig, oldName);

  res.json({request: {messageType}, response: {oldName, newScriptName}});
}));

router.post("/logs/email-routing", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const request: EmailRoutingLogsRequest = req.body;
  debugLog("POST /logs/email-routing request:", request);
  const cloudflareConfig = await configuredCloudflare();
  const logs = await queryEmailRoutingLogs(cloudflareConfig, request);
  debugLog("POST /logs/email-routing returned %d entries", logs.length);
  res.json({request: {messageType}, response: logs});
}));

router.post("/logs/workers", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const request: WorkerLogsRequest = req.body;
  debugLog("POST /logs/workers request:", request);
  const cloudflareConfig = await configuredCloudflare();
  const logs = await queryWorkerInvocationLogs(cloudflareConfig, request);
  debugLog("POST /logs/workers returned %d entries", logs.length);
  res.json({request: {messageType}, response: logs});
}));

const REQUIRED_MX_RECORDS = [
  {content: "route1.mx.cloudflare.net", priority: 16},
  {content: "route2.mx.cloudflare.net", priority: 99},
  {content: "route3.mx.cloudflare.net", priority: 2}
];

const requiredContents = new Set(REQUIRED_MX_RECORDS.map(mx => mx.content));

const buildMxStatus = (subdomain: string, existingRecords: DnsRecordResult[]): MxRecordStatus => {
  const expectedRecords = REQUIRED_MX_RECORDS.map(mx => ({
    content: mx.content,
    priority: mx.priority,
    exists: existingRecords.some(r => r.content === mx.content)
  }));
  const extraRecords = existingRecords.filter(r => !requiredContents.has(r.content));
  return {
    subdomain,
    allPresent: expectedRecords.every(r => r.exists),
    expectedRecords,
    existingRecords,
    extraRecords
  };
};

router.get("/mx-records", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const nsConfig = await nonSensitiveCloudflareConfig();
  if (!nsConfig.configured || !nsConfig.baseDomain) {
    throw new HttpError(400, "Cloudflare not configured or baseDomain not available");
  }

  const cloudflareConfig = await configuredCloudflare();
  const subdomain = nsConfig.baseDomain;
  const zone = await zoneForHostname(cloudflareConfig.apiToken, subdomain);
  if (!zone) {
    throw new HttpError(400, `No Cloudflare zone found for ${subdomain}. Add the zone in Cloudflare first.`);
  }
  const existingRecords = await listDnsRecords({apiToken: cloudflareConfig.apiToken, zoneId: zone.id}, subdomain, DnsRecordType.MX);
  res.json({request: {messageType}, response: buildMxStatus(subdomain, existingRecords)});
}));

router.post("/mx-records", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const nsConfig = await nonSensitiveCloudflareConfig();
  if (!nsConfig.configured || !nsConfig.baseDomain) {
    throw new HttpError(400, "Cloudflare not configured or baseDomain not available");
  }

  const cloudflareConfig = await configuredCloudflare();
  const subdomain = nsConfig.baseDomain;
  const zone = await zoneForHostname(cloudflareConfig.apiToken, subdomain);
  if (!zone) {
    throw new HttpError(400, `No Cloudflare zone found for ${subdomain}. Add the zone in Cloudflare first.`);
  }
  const dnsConfig = {apiToken: cloudflareConfig.apiToken, zoneId: zone.id};
  const existingRecords = await listDnsRecords(dnsConfig, subdomain, DnsRecordType.MX);

  for (const mx of REQUIRED_MX_RECORDS) {
    if (!existingRecords.some(r => r.content === mx.content)) {
      await createDnsRecord(dnsConfig, {type: DnsRecordType.MX, name: subdomain, content: mx.content, priority: mx.priority});
    }
  }

  const updatedRecords = await listDnsRecords(dnsConfig, subdomain, DnsRecordType.MX);
  res.json({request: {messageType}, response: buildMxStatus(subdomain, updatedRecords)});
}));

router.delete("/mx-records/:recordId", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const {recordId} = req.params;
  const nsConfig = await nonSensitiveCloudflareConfig();
  if (!nsConfig.configured || !nsConfig.baseDomain) {
    throw new HttpError(400, "Cloudflare not configured or baseDomain not available");
  }

  const cloudflareConfig = await configuredCloudflare();
  const subdomain = nsConfig.baseDomain;
  const zone = await zoneForHostname(cloudflareConfig.apiToken, subdomain);
  if (!zone) {
    throw new HttpError(400, `No Cloudflare zone found for ${subdomain}. Add the zone in Cloudflare first.`);
  }
  const dnsConfig = {apiToken: cloudflareConfig.apiToken, zoneId: zone.id};
  const existingRecords = await listDnsRecords(dnsConfig, subdomain, DnsRecordType.MX);
  const target = existingRecords.find(r => r.id === recordId);
  if (!target) {
    throw new HttpError(404, `MX record ${recordId} not found on ${subdomain}`);
  }
  if (requiredContents.has(target.content)) {
    throw new HttpError(400, `Refusing to delete required Cloudflare MX record ${target.content}`);
  }
  await deleteDnsRecord(dnsConfig, recordId);
  const updatedRecords = await listDnsRecords(dnsConfig, subdomain, DnsRecordType.MX);
  res.json({request: {messageType}, response: buildMxStatus(subdomain, updatedRecords)});
}));

router.post("/inbound-mime", handleInboundMime);

router.post("/inbound-inbox", handleInboundInbox);

router.get("/auth-records", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const nsConfig = await nonSensitiveCloudflareConfig();
  if (!nsConfig.configured || !nsConfig.baseDomain) {
    throw new HttpError(400, "Cloudflare not configured or baseDomain not available");
  }
  const cloudflareConfig = await configuredCloudflare();
  const domain = nsConfig.baseDomain;
  const zone = await zoneForHostname(cloudflareConfig.apiToken, domain);
  if (!zone) {
    throw new HttpError(400, `No Cloudflare zone found for ${domain}. Add the zone in Cloudflare first.`);
  }
  const status = await queryEmailAuthStatus({apiToken: cloudflareConfig.apiToken, zoneId: zone.id}, domain, zone.name);
  res.json({request: {messageType}, response: status});
}));

router.post("/auth-records", authConfig.authenticate(), asyncRoute(messageType, async (req: Request, res: Response) => {
  const nsConfig = await nonSensitiveCloudflareConfig();
  if (!nsConfig.configured || !nsConfig.baseDomain) {
    throw new HttpError(400, "Cloudflare not configured or baseDomain not available");
  }
  const cloudflareConfig = await configuredCloudflare();
  const domain = nsConfig.baseDomain;
  const zone = await zoneForHostname(cloudflareConfig.apiToken, domain);
  if (!zone) {
    throw new HttpError(400, `No Cloudflare zone found for ${domain}. Add the zone in Cloudflare first.`);
  }
  const status = await ensureEmailAuthRecords({apiToken: cloudflareConfig.apiToken, zoneId: zone.id}, domain, zone.name);
  res.json({request: {messageType}, response: status});
}));

export const cloudflareEmailRoutingRoutes = router;
