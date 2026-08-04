import WebSocket from "ws";
import debug from "debug";
import { keys } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { EnvironmentSetupRequest } from "./types";
import { findEnvironmentFromDatabase } from "../environments/environments-config";
import { loadSecretsWithFallback } from "../shared/secrets";
import { resumeEnvironment } from "../cli/commands/environment";
import { ResumeEnvironmentOptions } from "../cli/cli.model";
import { createEnvironment, validateSetupRequest } from "./environment-setup-service";
import { pluraliseWithCount } from "../shared/string-utils";
import { migrateFlyOrganisation } from "../fly/fly-org-migration";

export interface EnvironmentSetupWsData {
  environmentName: string;
  runFlyDeployment?: boolean;
  runDbInit?: boolean;
}

export interface EnvironmentCreateWsData {
  request: EnvironmentSetupRequest;
}

const debugLog = debug(envConfig.logNamespace("environment-setup-ws-handler"));
debugLog.enabled = true;

function sendProgress(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.PROGRESS,
    data: { message, ...data }
  }));
}

function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({
    type: MessageType.ERROR,
    data: { message }
  }));
}

function sendComplete(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.COMPLETE,
    data: { message, ...data }
  }));
}

export async function handleEnvironmentSetup(ws: WebSocket, data: EnvironmentSetupWsData): Promise<void> {
  debugLog("handleEnvironmentSetup received:", data);

  const { environmentName, runFlyDeployment, runDbInit } = data;

  if (!environmentName) {
    sendError(ws, "environmentName is required");
    return;
  }

  try {
    sendProgress(ws, "Loading environment configuration...");

    const envConfigData = await findEnvironmentFromDatabase(environmentName);
    if (!envConfigData) {
      sendError(ws, `Environment ${environmentName} not found in database`);
      return;
    }

    sendProgress(ws, `Found environment config for ${envConfigData.appName}`);

    const secretsFile = await loadSecretsWithFallback(environmentName, envConfigData.appName);
    if (keys(secretsFile.secrets).length > 0) {
      sendProgress(ws, `Loaded ${keys(secretsFile.secrets).length} secrets from ${secretsFile.path}`);
    }

    if (!runDbInit && !runFlyDeployment) {
      sendComplete(ws, "No actions requested", { environmentName });
      return;
    }

    const resumeOptions: ResumeEnvironmentOptions = {
      runDbInit: runDbInit || false,
      runFlyDeployment: runFlyDeployment || false,
      onDeployOutput: (line: string) => {
        sendProgress(ws, `[deploy] ${line}`);
      }
    };

    const result = await resumeEnvironment(
      environmentName,
      resumeOptions,
      progress => {
        sendProgress(ws, `[${progress.status}] ${progress.step}${progress.message ? `: ${progress.message}` : ""}`);
      }
    );

    sendComplete(ws, "Setup completed successfully", {
      result: {
        environmentName: result.environmentName,
        appName: result.appName,
        appUrl: result.appUrl
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment setup failed";
    debugLog("handleEnvironmentSetup error:", message);
    sendError(ws, message);
  }
}

export interface FlyOrgMigrateWsData {
  environmentName: string;
  destroyOldApp?: boolean;
  reattachSubdomain?: boolean;
  previousApiKey?: string;
  previousOrganisation?: string;
  previousAppName?: string;
  newApiKey?: string;
  newOrganisation?: string;
  newAppName?: string;
}

export async function handleFlyOrgMigrate(ws: WebSocket, data: FlyOrgMigrateWsData): Promise<void> {
  debugLog("handleFlyOrgMigrate received:", data);
  const {
    environmentName,
    destroyOldApp,
    reattachSubdomain,
    previousApiKey,
    previousOrganisation,
    previousAppName,
    newApiKey,
    newOrganisation,
    newAppName
  } = data || {} as FlyOrgMigrateWsData;
  if (!environmentName) {
    sendError(ws, "environmentName is required");
  } else {
    try {
      sendProgress(ws, `Starting Fly organisation migration for ${environmentName}...`);
      const result = await migrateFlyOrganisation(
        environmentName,
        {
          destroyOldApp,
          reattachSubdomain,
          previousApiKey,
          previousOrganisation,
          previousAppName,
          newApiKey,
          newOrganisation,
          newAppName,
          onDeployOutput: (line: string) => {
            sendProgress(ws, `[deploy] ${line}`);
          }
        },
        message => {
          sendProgress(ws, message);
        }
      );
      sendComplete(ws, `Fly organisation migration completed for ${environmentName}`, {
        result: {
          environmentName: result.environmentName,
          appName: result.appName,
          appUrl: result.appUrl,
          oldAppDestroyed: result.oldAppDestroyed,
          usedTemporaryAppName: result.usedTemporaryAppName,
          temporaryAppName: result.temporaryAppName
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fly organisation migration failed";
      debugLog("handleFlyOrgMigrate error:", message);
      sendError(ws, message);
    }
  }
}

export async function handleEnvironmentCreate(ws: WebSocket, data: EnvironmentCreateWsData): Promise<void> {
  debugLog("handleEnvironmentCreate received:", data);

  const { request } = data;

  if (!request) {
    sendError(ws, "request is required");
    return;
  }

  try {
    sendProgress(ws, "Validating setup request...");

    const validationResults = await validateSetupRequest(request);
    const failedValidations = validationResults.filter(r => !r.valid);
    if (failedValidations.length > 0) {
      const errorMessage = failedValidations.map(r => r.message).join("; ");
      sendError(ws, `Validation failed: ${errorMessage}`);
      return;
    }

    sendProgress(ws, "Validation passed, starting environment creation...");

    const result = await createEnvironment(
      request,
      progress => {
        sendProgress(ws, `[${progress.status}] ${progress.step}${progress.message ? `: ${progress.message}` : ""}`);
      },
      (line: string) => {
        sendProgress(ws, `[deploy] ${line}`);
      }
    );

    const warnings = result.warnings || [];
    const completionMessage = warnings.length > 0
      ? `Environment created with ${pluraliseWithCount(warnings.length, "step")} needing attention: ${warnings.map(warning => `${warning.step}: ${warning.message}`).join("; ")}`
      : "Environment created successfully";
    sendComplete(ws, completionMessage, {
      result: {
        environmentName: result.environmentName,
        appName: result.appName,
        appUrl: result.appUrl,
        configsJsonUpdated: result.configsJsonUpdated,
        passwordResetId: result.passwordResetId,
        adminUserName: result.adminUserName,
        adminEmail: result.adminEmail,
        warnings
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment creation failed";
    debugLog("handleEnvironmentCreate error:", message);
    sendError(ws, message);
  }
}
