import {
  IntegrationWorkerCallbackConfig,
  IntegrationWorkerProgressCallbackRequest,
  IntegrationWorkerResultCallbackRequest
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { signRamblersUploadBody } from "./integration-worker-crypto";

export async function postRamblersUploadProgressCallback(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, request: IntegrationWorkerProgressCallbackRequest): Promise<void> {
  await postRamblersUploadCallback(`${callback.baseUrl}${callback.progressPath}`, sharedSecret, request);
}

export async function postRamblersUploadResultCallback(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, request: IntegrationWorkerResultCallbackRequest): Promise<void> {
  await postRamblersUploadCallback(`${callback.baseUrl}${callback.resultPath}`, sharedSecret, request);
}

async function postRamblersUploadCallback(url: string, sharedSecret: string, request: object): Promise<void> {
  const body = JSON.stringify(request);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ramblers-upload-signature": signature
    },
    body
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Ramblers upload callback failed with status ${response.status}: ${responseBody}`);
  }
}
