import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { AiConnectionStatus, CoverImageCandidate } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { signRamblersUploadBody } from "../ramblers/integration-worker-crypto";

const debugLog = debug(envConfig.logNamespace("ai:worker-client"));
debugLog.enabled = false;

export function integrationWorkerConfigured(): boolean {
  return !!(envConfig.value(Environment.INTEGRATION_WORKER_URL) && envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET));
}

async function callWorker<T>(operationPath: string, payload: object): Promise<T> {
  const workerUrl = required(Environment.INTEGRATION_WORKER_URL);
  const sharedSecret = required(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const body = JSON.stringify(payload);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/api/integration-worker/ai/${operationPath}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"content-type": "application/json", "x-ramblers-upload-signature": signature},
    body
  });
  const text = await response.text();
  if (!response.ok) {
    debugLog(operationPath, "failed", response.status, text.slice(0, 200));
    throw new Error(`Integration worker ai/${operationPath} failed with status ${response.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function rewriteViaIntegrationWorker(config: Ai, input: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const result = await callWorker<{ output: string }>("rewrite", {config, input, systemPrompt, maxTokens});
  return result.output;
}

export async function meetingMinutesViaIntegrationWorker(
  config: Ai,
  transcript: string,
  chat: string,
  existingNotes: string
): Promise<string> {
  const result = await callWorker<{ output: string }>("meeting-minutes", {
    config,
    transcript,
    chat,
    existingNotes,
    maxTokens: 2048
  });
  return result.output;
}

export async function aiStatusViaIntegrationWorker(config: Ai): Promise<AiConnectionStatus> {
  return callWorker<AiConnectionStatus>("status", {config});
}

export async function chooseCoverViaIntegrationWorker(
  config: Ai,
  candidates: CoverImageCandidate[],
  rootFolder?: string,
  albumName?: string
): Promise<string | null> {
  const result = await callWorker<{ image: string | null }>("choose-cover", {config, candidates, rootFolder, albumName});
  return result?.image ?? null;
}

function required(key: Environment): string {
  const value = envConfig.value(key);
  if (!value) {
    throw new Error(`Environment variable '${key}' must be set to call the integration worker AI API`);
  }
  return value;
}
