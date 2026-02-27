import WebSocket from "ws";
import debug from "debug";
import { keys } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { EnvironmentSetupRequest } from "./types";
import { findEnvironmentFromDatabase } from "../environments/environments-config";
import { loadSecretsWithFallback } from "../shared/secrets";
import { ResumeEnvironmentOptions, resumeEnvironment } from "../cli/commands/environment";
import { createEnvironment, validateSetupRequest } from "./environment-setup-service";

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

    const result = await createEnvironment(request, progress => {
      sendProgress(ws, `[${progress.status}] ${progress.step}${progress.message ? `: ${progress.message}` : ""}`);
    });

    sendComplete(ws, "Environment created successfully", {
      result: {
        environmentName: result.environmentName,
        appName: result.appName,
        appUrl: result.appUrl,
        configsJsonUpdated: result.configsJsonUpdated,
        passwordResetId: result.passwordResetId
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment creation failed";
    debugLog("handleEnvironmentCreate error:", message);
    sendError(ws, message);
  }
}
