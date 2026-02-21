import debug from "debug";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ConfigDocument, ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { envConfig } from "../../env-config/env-config";
import { config } from "../models/config";
import * as crudController from "./crud-controller";
import * as transforms from "./transforms";
import { createDocumentRequest, parseError, toObjectWithId } from "./transforms";
import { enumForKey, enumValues } from "../../../../projects/ngx-ramblers/src/app/functions/enums";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { isArray, isNull, isObject, isUndefined } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("config"));
debugLog.enabled = false;
const controller = crudController.create<ConfigDocument>(config);

const sensitiveKeys = new Set([
  "apiKey",
  "accessKey",
  "accessKeyId",
  "secretAccessKey",
  "clientSecret",
  "accessToken",
  "refreshToken",
  "password",
  "username",
  "userName",
  "uri",
  "secretKey",
]);

const adminOnlyConfigKeys = new Set([
  ConfigKey.ENVIRONMENTS,
  ConfigKey.BREVO,
  ConfigKey.MAILCHIMP,
  ConfigKey.MAIL,
]);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;

function criteriaForKey(configKey: ConfigKey) {
  const criteria = {key: {$eq: configKey}};
  debugLog("criteriaForKey:", configKey, "returning:", criteria);
  return criteria;
}

function configCriteriaFromBody(req: Request) {
  const configDocument: ConfigDocument = req.body;
  const configKey: ConfigKey = configDocument.key;
  return criteriaForKey(configKey);
}

function configKeyFromQuerystring(req: Request): ConfigKey {
  const keyAsString = req.query.key as string;
  const key = enumForKey(ConfigKey, keyAsString);
  if (key) {
    return key;
  } else {
    const message = keyAsString ? `invalid key ${keyAsString}` : `no key`;
    throw new Error(`${message} supplied in querystring - must be one of ${enumValues(ConfigKey).join(", ")}`);
  }
}

function configCriteriaFromQuerystring(req: Request) {
  const configKey = configKeyFromQuerystring(req);
  return criteriaForKey(configKey);
}

export async function createOrUpdate(req: Request, res: Response) {
  const isAdmin = isAdminFromRequest(req);

  if (!isAdmin) {
    return res.status(403).json({
      message: "Admin access required to update system configuration",
      error: "Forbidden"
    });
  }

  const {document} = transforms.criteriaAndDocument(req);
  const criteria = configCriteriaFromBody(req);
  debugLog("pre-update:body:", req.body, "criteria:", criteria, "document:", document);

  try {
    const existingConfig = await config.findOne(criteria);
    const incomingValue = req.body?.value;

    if (existingConfig?.value && incomingValue) {
      req.body.value = restoreSensitiveFields(existingConfig.value, incomingValue);
    }

    const documentRequest = createDocumentRequest(req);
    const result = await config.findOneAndUpdate(criteria, documentRequest, {upsert: true, new: true, useFindAndModify: false});
    debugLog("post-update:document:", documentRequest, "result:", result);
    res.status(200).json({
      action: ApiAction.UPDATE,
      response: toObjectWithId(result)
    });
  } catch (error) {
    return res.status(500).json({
      message: `Update of ${config.modelName} failed`,
      request: document,
      error: parseError(error)
    });
  }
}

export function queryKey(configKey: ConfigKey): Promise<ConfigDocument> {
  return config.findOne(criteriaForKey(configKey))
    .then(response => toObjectWithId(response));
}

export async function createOrUpdateKey(configKey: ConfigKey, value: any): Promise<ConfigDocument> {
  const criteria = criteriaForKey(configKey);
  const result = await config.findOneAndUpdate(
    criteria,
    { key: configKey, value },
    { upsert: true, new: true, useFindAndModify: false }
  );
  debugLog(`createOrUpdateKey: ${configKey} updated`);
  return toObjectWithId(result);
}

export function handleQuery(req: Request, res: Response): Promise<any> {
  try {
    const configKey = configKeyFromQuerystring(req);
    const tokenPresent = hasAuthToken(req);
    const { isAdmin, tokenValid } = resolveTokenStatus(req);

    if (adminOnlyConfigKeys.has(configKey) && !isAdmin) {
      if (tokenPresent && !tokenValid) {
        debugLog(`Rejected expired/invalid token for admin-only config: ${configKey}`);
        return Promise.resolve(res.status(401).json({
          message: "Token expired or invalid",
          error: "Unauthorized"
        }));
      }
      debugLog(`Blocked unauthenticated access to admin-only config: ${configKey}`);
      return Promise.resolve(res.status(403).json({
        message: "Authentication required to access this configuration",
        error: "Forbidden"
      }));
    }

    const criteria = criteriaForKey(configKey);
    return config.findOne(criteria)
      .then(response => {
        const configDocument: ConfigDocument = toObjectWithId(response);
        const redactedValue = isAdmin ? configDocument?.value : redactSensitive(configDocument?.value);
        debugLog(req.query, "findByConditions:criteria", criteria, "isAdmin:", isAdmin);
        return res.status(200).json({
          action: ApiAction.QUERY,
          response: redactedValue
        });
      })
      .catch(error => {
        controller.errorDebugLog(`findByConditions: ${config.modelName} error: ${error}`);
        res.status(500).json({
          message: `${config.modelName} query failed`,
          request: req.query,
          error: parseError(error),
          stack: error.stack
        });
      });
  } catch (e) {
    controller.errorDebugLog("findByConditions:catch", e);
    res.status(500).json({
      message: `query of config key failed`,
      request: req.query,
      error: parseError(e)
    });
  }
}

function verifiedTokenPayload(req: Request): any {
  const authHeader = req.headers?.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) return null;
  return jwt.verify(token, envConfig.auth().secret);
}

function hasAdminRole(payload: any): boolean {
  return !!(payload?.memberAdmin || payload?.contentAdmin || payload?.fileAdmin || payload?.walkAdmin || payload?.socialAdmin || payload?.treasuryAdmin || payload?.financeAdmin);
}

function hasAuthToken(req: Request): boolean {
  const authHeader = req.headers?.authorization || "";
  return authHeader.startsWith("Bearer ");
}

function resolveTokenStatus(req: Request): { isAdmin: boolean; tokenValid: boolean } {
  if (!hasAuthToken(req)) {
    return { isAdmin: false, tokenValid: true };
  }
  try {
    const payload = verifiedTokenPayload(req);
    return { isAdmin: payload ? hasAdminRole(payload) : false, tokenValid: true };
  } catch (error) {
    debugLog("Token verification failed:", error);
    return { isAdmin: false, tokenValid: false };
  }
}

function isAdminFromRequest(req: Request): boolean {
  try {
    const payload = verifiedTokenPayload(req);
    return hasAdminRole(payload);
  } catch {
    return false;
  }
}

function redactSensitive(value: any): any {
  function cleanse(obj: any): any {
    if (isNull(obj) || isUndefined(obj)) return obj;
    if (isArray(obj)) return obj.map(cleanse);
    if (!isObject(obj)) return obj;
    const out: any = isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.has(k)) {
        continue;
      }
      out[k] = cleanse(v);
    }
    return out;
  }

  return cleanse(value);
}

function restoreSensitiveFields(existingValue: any, incomingValue: any): any {
  function restore(existing: any, incoming: any): any {
    if (isNull(existing) || isUndefined(existing)) return incoming;
    if (isNull(incoming) || isUndefined(incoming)) return existing;
    if (isArray(existing) && isArray(incoming)) {
      return incoming.map((item, idx) => restore(existing[idx], item));
    }
    if (isObject(existing) && isObject(incoming)) {
      const merged = {...incoming};
      for (const [k, v] of Object.entries(existing)) {
        if (sensitiveKeys.has(k)) {
          if (!(k in incoming)) {
            merged[k] = v;
          }
        } else if (isObject(v) && k in incoming && !isNull(incoming[k])) {
          merged[k] = restore(v, incoming[k]);
        }
      }
      return merged;
    }
    return incoming;
  }

  return restore(existingValue, incomingValue);
}
