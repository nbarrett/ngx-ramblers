import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { EnvironmentSetupRequest } from "./types";
import { findEnvironment } from "../shared/configs-json";
import { loadSecretsForEnvironment } from "../shared/secrets";
import { resumeEnvironment } from "../cli/commands/environment";
import { createEnvironment, validateSetupRequest } from "./environment-setup-service";

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

export async function handleEnvironmentSetup(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleEnvironmentSetup received:", data);

  const { environmentName, runFlyDeployment, runDbInit } = data;

  if (!environmentName) {
    sendError(ws, "environmentName is required");
    return;
  }

  try {
    sendProgress(ws, "Loading environment configuration...");

    const envConfigData = findEnvironment(environmentName);
    if (!envConfigData) {
      sendError(ws, `Environment ${environmentName} not found in configs.json`);
      return;
    }

    sendProgress(ws, `Found environment config for ${envConfigData.appName}`);

    const secretsFile = loadSecretsForEnvironment(envConfigData.appName);
    if (Object.keys(secretsFile.secrets).length > 0) {
      sendProgress(ws, `Loaded ${Object.keys(secretsFile.secrets).length} secrets`);
    }

    if (!runDbInit && !runFlyDeployment) {
      sendComplete(ws, "No actions requested", { environmentName });
      return;
    }

    const result = await resumeEnvironment(
      environmentName,
      {
        runDbInit: runDbInit || false,
        runFlyDeployment: runFlyDeployment || false
      },
      (progress) => {
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

export async function handleEnvironmentCreate(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleEnvironmentCreate received:", data);

  const request: EnvironmentSetupRequest = data.request;

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

    const result = await createEnvironment(request, (progress) => {
      sendProgress(ws, `[${progress.status}] ${progress.step}${progress.message ? `: ${progress.message}` : ""}`);
    });

    sendComplete(ws, "Environment created successfully", {
      result: {
        environmentName: result.environmentName,
        appName: result.appName,
        appUrl: result.appUrl,
        configsJsonUpdated: result.configsJsonUpdated
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment creation failed";
    debugLog("handleEnvironmentCreate error:", message);
    sendError(ws, message);
  }
}
