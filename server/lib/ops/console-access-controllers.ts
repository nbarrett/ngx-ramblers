import debug from "debug";
import { Request, Response } from "express";
import { isObject, isString, keys } from "es-toolkit/compat";
import {
  ConsoleAccessLogin,
  ConsoleAccessService,
  EnvironmentConsoleAccess,
  EnvironmentsConfig
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";
import { connect as connectToDatabase } from "../mongo/mongoose-client";
import { envConfig } from "../env-config/env-config";
import {
  CONSOLE_ACCESS_SERVICES,
  loginHasContent,
  resolveConsoleUrls
} from "./console-access-catalogue";

const debugLog = debug(envConfig.logNamespace("ops:console-access-controllers"));
debugLog.enabled = true;

const PLATFORM_SCOPE = "platform";

export interface ConsoleAccessDocument {
  scope: string;
  environment: string | null;
  consoleAccess: EnvironmentConsoleAccess;
  services: Array<{
    serviceId: ConsoleAccessService;
    name: string;
    function: string;
    scope: string;
    identifiers: Array<{key: string; label: string; placeholder?: string}>;
    urls: Array<{label: string; urlTemplate: string}>;
    resolvedUrls: Array<{label: string; url: string}>;
  }>;
}

function cleanIdentifiers(input: unknown, allowedKeys: string[]): Record<string, string> {
  if (!isObject(input)) {
    return {};
  } else {
    const source = input as Record<string, unknown>;
    return allowedKeys.reduce((acc, key) => {
      const value = source[key];
      if (isString(value) && value.trim()) {
        acc[key] = value.trim();
      }
      return acc;
    }, {} as Record<string, string>);
  }
}

function cleanLogin(input: unknown, serviceId: ConsoleAccessService): ConsoleAccessLogin {
  if (!isObject(input)) {
    return {};
  } else {
    const record = input as Record<string, unknown>;
    const service = CONSOLE_ACCESS_SERVICES.find(item => item.serviceId === serviceId);
    const allowedKeys = (service?.identifiers || []).map(item => item.key);
    const result: ConsoleAccessLogin = {};
    if (isString(record.login) && record.login.trim()) {
      result.login = record.login.trim();
    }
    if (isString(record.password) && record.password.trim()) {
      result.password = record.password.trim();
    }
    if (isString(record.notes) && record.notes.trim()) {
      result.notes = record.notes.trim();
    }
    const identifiers = cleanIdentifiers(record.identifiers, allowedKeys);
    if (keys(identifiers).length > 0) {
      result.identifiers = identifiers;
    }
    return result;
  }
}

function cleanConsoleAccess(input: unknown): EnvironmentConsoleAccess {
  if (!isObject(input)) {
    return {};
  } else {
    const source = input as Record<string, unknown>;
    return CONSOLE_ACCESS_SERVICES.reduce((acc, service) => {
      const cleaned = cleanLogin(source[service.serviceId], service.serviceId);
      if (loginHasContent(cleaned)) {
        acc[service.serviceId] = cleaned;
      }
      return acc;
    }, {} as EnvironmentConsoleAccess);
  }
}

async function loadEnvironmentsConfig(): Promise<EnvironmentsConfig> {
  await connectToDatabase(debugLog);
  const existingDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
  return (existingDoc?.value || {environments: []}) as EnvironmentsConfig;
}

function serviceCatalogue(consoleAccess: EnvironmentConsoleAccess) {
  return CONSOLE_ACCESS_SERVICES.map(service => ({
    serviceId: service.serviceId,
    name: service.name,
    function: service.function,
    scope: service.scope,
    identifiers: service.identifiers,
    urls: service.urls,
    resolvedUrls: resolveConsoleUrls(service, consoleAccess[service.serviceId]?.identifiers)
  }));
}

export async function getConsoleAccess(req: Request, res: Response): Promise<void> {
  try {
    const scope = isString(req.query?.scope) ? req.query.scope : PLATFORM_SCOPE;
    const environmentsConfig = await loadEnvironmentsConfig();
    if (scope === PLATFORM_SCOPE) {
      const consoleAccess = environmentsConfig.consoleAccess || {};
      res.json({
        scope: PLATFORM_SCOPE,
        environment: null,
        consoleAccess,
        services: serviceCatalogue(consoleAccess)
      } as ConsoleAccessDocument);
    } else {
      const environment = scope;
      const env = (environmentsConfig.environments || []).find(item => item.environment === environment);
      if (!env) {
        res.status(404).json({error: `Environment not found: ${environment}`});
      } else {
        const consoleAccess = env.consoleAccess || {};
        res.json({
          scope: environment,
          environment,
          consoleAccess,
          services: serviceCatalogue(consoleAccess)
        } as ConsoleAccessDocument);
      }
    }
  } catch (error) {
    debugLog("getConsoleAccess failed: %s", error?.stack || error);
    res.status(500).json({error: error?.message || "Failed to load system logins"});
  }
}

export async function saveConsoleAccess(req: Request, res: Response): Promise<void> {
  try {
    const scope = isString(req.body?.scope) ? req.body.scope : PLATFORM_SCOPE;
    const consoleAccess = cleanConsoleAccess(req.body?.consoleAccess);
    const environmentsConfig = await loadEnvironmentsConfig();
    if (scope === PLATFORM_SCOPE) {
      const next: EnvironmentsConfig = {
        ...environmentsConfig,
        consoleAccess
      };
      await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, next);
      debugLog("Saved platform system logins (%d services)", keys(consoleAccess).length);
      res.json({
        scope: PLATFORM_SCOPE,
        environment: null,
        consoleAccess,
        services: serviceCatalogue(consoleAccess)
      } as ConsoleAccessDocument);
    } else {
      const environment = scope;
      const environments = [...(environmentsConfig.environments || [])];
      const index = environments.findIndex(item => item.environment === environment);
      if (index < 0) {
        res.status(404).json({error: `Environment not found: ${environment}`});
      } else {
        environments[index] = {
          ...environments[index],
          consoleAccess
        };
        await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, {
          ...environmentsConfig,
          environments
        });
        debugLog("Saved system logins for %s (%d services)", environment, keys(consoleAccess).length);
        res.json({
          scope: environment,
          environment,
          consoleAccess,
          services: serviceCatalogue(consoleAccess)
        } as ConsoleAccessDocument);
      }
    }
  } catch (error) {
    debugLog("saveConsoleAccess failed: %s", error?.stack || error);
    res.status(500).json({error: error?.message || "Failed to save system logins"});
  }
}

export async function listConsoleAccessEnvironments(_req: Request, res: Response): Promise<void> {
  try {
    const environmentsConfig = await loadEnvironmentsConfig();
    const environments = (environmentsConfig.environments || []).map(env => ({
      environment: env.environment,
      hasConsoleAccess: !!(env.consoleAccess && keys(env.consoleAccess).length > 0)
    }));
    res.json({
      platformHasConsoleAccess: !!(environmentsConfig.consoleAccess && keys(environmentsConfig.consoleAccess).length > 0),
      environments
    });
  } catch (error) {
    debugLog("listConsoleAccessEnvironments failed: %s", error?.stack || error);
    res.status(500).json({error: error?.message || "Failed to list environments"});
  }
}
