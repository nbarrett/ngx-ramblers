import debug from "debug";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as authConfig from "../auth/auth-config";
import { configuredCloudflare, nonSensitiveCloudflareConfig } from "./cloudflare-config";
import {
  catchAllRule,
  createEmailRoutingRule,
  deleteEmailRoutingRule,
  listEmailRoutingRules,
  updateEmailRoutingRule
} from "./cloudflare-email-routing";
import {
  createDestinationAddress,
  deleteDestinationAddress,
  listDestinationAddresses
} from "./cloudflare-destination-addresses";
import {
  deleteWorkerScript,
  fetchWorkerScriptContent,
  generateWorkerScript,
  listWorkerScripts,
  parseRecipientsFromScript,
  uploadWorkerScript,
  workerScriptName
} from "./cloudflare-email-workers";
import { queryEmailRoutingLogs, queryWorkerInvocationLogs } from "./cloudflare-analytics";
import {
  CreateOrUpdateEmailRouteRequest,
  CreateOrUpdateWorkerRequest,
  EmailRoutingLogsRequest,
  EmailRoutingMatcherType,
  EmailRoutingMatcherField,
  EmailRoutingActionType,
  WorkerLogsRequest
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";

const messageType = "cloudflare:email-routing";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace(messageType));
errorDebugLog.enabled = true;

const router = express.Router();

function errorResponse(error: any) {
  if (error instanceof Error) {
    return {code: error.name, message: error.message};
  }
  return {message: String(error)};
}

router.get("/config", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const config = await nonSensitiveCloudflareConfig();
    res.json({request: {messageType}, response: config});
  } catch (error) {
    errorDebugLog("Error fetching cloudflare config:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/rules", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const rules = await listEmailRoutingRules(cloudflareConfig);
    res.json({request: {messageType}, response: rules});
  } catch (error) {
    errorDebugLog("Error listing email routing rules:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/rules/catch-all", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const rule = await catchAllRule(cloudflareConfig);
    res.json({request: {messageType}, response: rule});
  } catch (error) {
    errorDebugLog("Error fetching catch-all rule:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/rules", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const request: CreateOrUpdateEmailRouteRequest = req.body;
    const rule = await createEmailRoutingRule(cloudflareConfig, {
      name: `Forward ${request.roleName} to ${request.destinationEmail}`,
      enabled: request.enabled,
      matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: request.roleEmail}],
      actions: [{type: EmailRoutingActionType.FORWARD, value: [request.destinationEmail]}]
    });
    res.json({request: {messageType}, response: rule});
  } catch (error) {
    errorDebugLog("Error creating email routing rule:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/rules/:ruleId", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const request: CreateOrUpdateEmailRouteRequest = req.body;
    const rule = await updateEmailRoutingRule(cloudflareConfig, req.params.ruleId, {
      name: `Forward ${request.roleName} to ${request.destinationEmail}`,
      enabled: request.enabled,
      matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: request.roleEmail}],
      actions: [{type: EmailRoutingActionType.FORWARD, value: [request.destinationEmail]}]
    });
    res.json({request: {messageType}, response: rule});
  } catch (error) {
    errorDebugLog("Error updating email routing rule:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.delete("/rules/:ruleId", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    await deleteEmailRoutingRule(cloudflareConfig, req.params.ruleId);
    res.json({request: {messageType}, response: {deleted: true}});
  } catch (error) {
    errorDebugLog("Error deleting email routing rule:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/destination-addresses", authConfig.authenticate(), async (req: Request, res: Response) => {
  debugLog("GET /destination-addresses");
  try {
    const cloudflareConfig = await configuredCloudflare();
    const addresses = await listDestinationAddresses(cloudflareConfig);
    debugLog("GET /destination-addresses returned %d addresses", addresses.length);
    res.json({request: {messageType}, response: addresses});
  } catch (error) {
    errorDebugLog("Error listing destination addresses:", error.message, error.stack);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/destination-addresses", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const {email} = req.body;
    const address = await createDestinationAddress(cloudflareConfig, email);
    res.json({request: {messageType}, response: address});
  } catch (error) {
    errorDebugLog("Error creating destination address:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.delete("/destination-addresses/:addressId", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    await deleteDestinationAddress(cloudflareConfig, req.params.addressId);
    res.json({request: {messageType}, response: {deleted: true}});
  } catch (error) {
    errorDebugLog("Error deleting destination address:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/workers", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const nsConfig = await nonSensitiveCloudflareConfig();
    const sanitisedDomain = nsConfig.baseDomain?.replace(/\./g, "-") || "";
    const prefix = `email-fwd-${sanitisedDomain}`;
    const allScripts = await listWorkerScripts(cloudflareConfig);
    const filtered = allScripts.filter(s => s.id?.startsWith(prefix));
    res.json({request: {messageType}, response: filtered});
  } catch (error) {
    errorDebugLog("Error listing worker scripts:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/workers/:scriptName/recipients", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const scriptContent = await fetchWorkerScriptContent(cloudflareConfig, req.params.scriptName);
    const recipients = parseRecipientsFromScript(scriptContent);
    res.json({request: {messageType}, response: recipients});
  } catch (error) {
    errorDebugLog("Error fetching worker recipients:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/workers", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const nsConfig = await nonSensitiveCloudflareConfig();
    const request: CreateOrUpdateWorkerRequest = req.body;
    const scriptName = workerScriptName(nsConfig.baseDomain, request.roleType);
    const scriptContent = generateWorkerScript(request.recipients);

    await uploadWorkerScript(cloudflareConfig, scriptName, scriptContent);

    const rules = await listEmailRoutingRules(cloudflareConfig);
    const existingRule = rules.find(rule =>
      rule.matchers?.some(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO && m.value === request.roleEmail)
    );

    const workerRule = {
      name: `Worker forward ${request.roleName} (${request.recipients.length} recipients)`,
      enabled: request.enabled,
      matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: request.roleEmail}],
      actions: [{type: EmailRoutingActionType.WORKER, value: [scriptName]}]
    };

    if (existingRule) {
      await updateEmailRoutingRule(cloudflareConfig, existingRule.id, workerRule);
    } else {
      await createEmailRoutingRule(cloudflareConfig, workerRule);
    }

    res.json({request: {messageType}, response: {scriptName, recipients: request.recipients}});
  } catch (error) {
    errorDebugLog("Error creating/updating worker:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.delete("/workers/:scriptName", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    errorDebugLog("Error deleting worker:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/workers/:oldName/rename", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    errorDebugLog("Error renaming worker:", error.message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/logs/email-routing", authConfig.authenticate(), async (req: Request, res: Response) => {
  const request: EmailRoutingLogsRequest = req.body;
  debugLog("POST /logs/email-routing request:", request);
  try {
    const cloudflareConfig = await configuredCloudflare();
    const logs = await queryEmailRoutingLogs(cloudflareConfig, request);
    debugLog("POST /logs/email-routing returned %d entries", logs.length);
    res.json({request: {messageType}, response: logs});
  } catch (error) {
    errorDebugLog("Error querying email routing logs:", error.message, error.stack);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/logs/workers", authConfig.authenticate(), async (req: Request, res: Response) => {
  const request: WorkerLogsRequest = req.body;
  debugLog("POST /logs/workers request:", request);
  try {
    const cloudflareConfig = await configuredCloudflare();
    const logs = await queryWorkerInvocationLogs(cloudflareConfig, request);
    debugLog("POST /logs/workers returned %d entries", logs.length);
    res.json({request: {messageType}, response: logs});
  } catch (error) {
    errorDebugLog("Error querying worker logs:", error.message, error.stack);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

export const cloudflareEmailRoutingRoutes = router;
