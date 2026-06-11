import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  DocumentConversionWorkerRequest,
  DocumentConversionWorkerResponse
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { signRamblersUploadBody } from "../ramblers/integration-worker-crypto";

const debugLog = debug(envConfig.logNamespace("document-conversion-worker-client"));
debugLog.enabled = true;

export function documentConversionWorkerConfigured(): boolean {
  return !!envConfig.value(Environment.INTEGRATION_WORKER_URL) && !!envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
}

export async function convertDocumentViaIntegrationWorker(buffer: Buffer, fileName: string): Promise<DocumentConversionWorkerResponse> {
  const workerUrl = envConfig.value(Environment.INTEGRATION_WORKER_URL);
  const sharedSecret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const request: DocumentConversionWorkerRequest = {fileName, fileBase64: buffer.toString("base64")};
  const body = JSON.stringify(request);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/api/integration-worker/document-conversion/convert`;
  debugLog("-> convert:", fileName, "endpoint:", endpoint, "bytes:", body.length);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"content-type": "application/json", "x-ramblers-upload-signature": signature},
    body
  });
  const text = await response.text();
  if (!response.ok) {
    debugLog("<- convert failed:", fileName, "status:", response.status, "body:", text.slice(0, 300));
    throw new Error(`Integration worker document conversion failed with status ${response.status}: ${text.slice(0, 300)}`);
  }
  const parsed: DocumentConversionWorkerResponse = JSON.parse(text);
  debugLog("<- convert done:", fileName, "markdown:", parsed.markdown?.length, "images:", parsed.images?.length);
  return parsed;
}
