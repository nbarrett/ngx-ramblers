import debug from "debug";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EmailWorkerScript } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { CloudflareResponse } from "./cloudflare-dns";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:email-workers"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("cloudflare:email-workers"));
errorDebugLog.enabled = true;

function accountBaseUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`;
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`
  };
}

export function workerScriptName(baseDomain: string, roleType: string): string {
  const sanitisedDomain = baseDomain.replace(/\./g, "-");
  return `email-fwd-${sanitisedDomain}-${roleType}`;
}

export function generateWorkerScript(recipients: string[]): string {
  const destinations = recipients
    .map(email => `    "${email}"`)
    .join(",\n");
  return `export default {
  async email(message, env, ctx) {
    const destinations = [
${destinations}
    ];
    for (const dest of destinations) {
      try {
        await message.forward(dest);
      } catch (error) {
        console.error("Failed to forward to " + dest + ":", error.message || error);
      }
    }
  }
};
`;
}

export async function uploadWorkerScript(cloudflareConfig: CloudflareConfig, scriptName: string, scriptContent: string): Promise<EmailWorkerScript> {
  const url = `${accountBaseUrl(cloudflareConfig.accountId)}/${scriptName}`;
  debugLog("Uploading worker script: %s", scriptName);

  const metadata = JSON.stringify({
    main_module: "worker.js",
    compatibility_date: "2024-01-01"
  });

  const formData = new FormData();
  formData.append("metadata", new Blob([metadata], {type: "application/json"}), "metadata.json");
  formData.append("worker.js", new Blob([scriptContent], {type: "application/javascript+module"}), "worker.js");

  const response = await fetch(url, {
    method: "PUT",
    headers: headers(cloudflareConfig.apiToken),
    body: formData
  });

  const data: CloudflareResponse<EmailWorkerScript> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to upload worker script ${scriptName}: ${errorMsg}`);
  }

  debugLog("Worker script uploaded: %s", scriptName);
  return data.result;
}

export async function listWorkerScripts(cloudflareConfig: CloudflareConfig): Promise<EmailWorkerScript[]> {
  const url = accountBaseUrl(cloudflareConfig.accountId);
  debugLog("Listing worker scripts for account: %s", cloudflareConfig.accountId);

  const response = await fetch(url, {
    headers: {
      ...headers(cloudflareConfig.apiToken),
      "Content-Type": "application/json"
    }
  });

  const data: CloudflareResponse<EmailWorkerScript[]> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to list worker scripts: ${errorMsg}`);
  }

  debugLog("Found %d worker scripts", data.result.length);
  return data.result;
}

export async function deleteWorkerScript(cloudflareConfig: CloudflareConfig, scriptName: string): Promise<void> {
  const url = `${accountBaseUrl(cloudflareConfig.accountId)}/${scriptName}`;
  debugLog("Deleting worker script: %s", scriptName);

  const response = await fetch(url, {
    method: "DELETE",
    headers: headers(cloudflareConfig.apiToken)
  });

  const data: CloudflareResponse<{ id: string }> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to delete worker script ${scriptName}: ${errorMsg}`);
  }

  debugLog("Worker script deleted: %s", scriptName);
}

export function parseRecipientsFromScript(scriptContent: string): string[] {
  const pattern = /"([^"]+@[^"]+)"/g;
  const recipients: string[] = [];
  let match: RegExpExecArray | null;
  match = pattern.exec(scriptContent);
  while (match !== null) {
    recipients.push(match[1]);
    match = pattern.exec(scriptContent);
  }
  return recipients;
}

export async function fetchWorkerScriptContent(cloudflareConfig: CloudflareConfig, scriptName: string): Promise<string> {
  const url = `${accountBaseUrl(cloudflareConfig.accountId)}/${scriptName}`;
  debugLog("Fetching worker script content: %s", scriptName);

  const response = await fetch(url, {
    headers: {
      ...headers(cloudflareConfig.apiToken),
      "Accept": "application/javascript"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch worker script ${scriptName}: ${response.statusText}`);
  }

  return response.text();
}
