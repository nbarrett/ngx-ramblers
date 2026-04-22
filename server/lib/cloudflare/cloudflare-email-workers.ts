import debug from "debug";
import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  EmailForwardingMode,
  EmailWorkerScript,
  WorkerScriptRecipientsInfo
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { cloudflareApi, CloudflareResponse } from "./cloudflare.model";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:email-workers"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("cloudflare:email-workers"));
errorDebugLog.enabled = true;

function accountBaseUrl(accountId: string): string {
  return cloudflareApi.accountWorkersScripts(accountId);
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

const MODE_MARKER_PREFIX = "// ngx-forwarding-mode:";

const TEMPLATE_DIR = path.join(__dirname, "worker-templates");

function loadTranspiledTemplate(templateBaseName: string): string {
  const tsPath = path.join(TEMPLATE_DIR, `${templateBaseName}.template.ts`);
  const tsSource = fs.readFileSync(tsPath, "utf-8");
  const result = ts.transpileModule(tsSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      isolatedModules: true
    }
  });
  return stripImports(result.outputText);
}

function stripImports(source: string): string {
  return source
    .split("\n")
    .filter(line => !/^\s*import\s/.test(line) && !/^\s*export\s+\{\s*\}/.test(line))
    .join("\n");
}

function substitutePlaceholders(source: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, jsonValue]) => acc.replace(new RegExp(key, "g"), () => jsonValue),
    source
  );
}

export function generateWorkerScript(
  recipients: string[],
  mode: EmailForwardingMode = EmailForwardingMode.CLOUDFLARE_FORWARD,
  options?: { roleEmail?: string; roleName?: string; webhookUrl?: string }
): string {
  const marker = `${MODE_MARKER_PREFIX} ${mode}\n`;
  if (mode === EmailForwardingMode.BREVO_RESEND) {
    return marker + substitutePlaceholders(loadTranspiledTemplate("brevo-resend"), {
      __RECIPIENTS__: JSON.stringify(recipients),
      __SENDER_EMAIL__: JSON.stringify(options?.roleEmail || ""),
      __SENDER_NAME__: JSON.stringify(options?.roleName || ""),
      __WEBHOOK_URL__: JSON.stringify(options?.webhookUrl || "")
    });
  }
  return marker + substitutePlaceholders(loadTranspiledTemplate("cloudflare-forward"), {
    __RECIPIENTS__: JSON.stringify(recipients)
  });
}

export function detectForwardingMode(scriptContent: string): EmailForwardingMode {
  if (scriptContent.includes(`${MODE_MARKER_PREFIX} ${EmailForwardingMode.BREVO_RESEND}`)) {
    return EmailForwardingMode.BREVO_RESEND;
  }
  return EmailForwardingMode.CLOUDFLARE_FORWARD;
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
  const blockMatch = scriptContent.match(/const\s+(?:destinations|recipients)\s*(?::[^=]+)?\s*=\s*\[([\s\S]*?)\]/);
  if (!blockMatch) {
    return [];
  }
  const pattern = /"([^"]+@[^"]+)"/g;
  return Array.from(blockMatch[1].matchAll(pattern)).map(m => m[1]);
}

export function parseWorkerScriptInfo(scriptContent: string): WorkerScriptRecipientsInfo {
  return {
    recipients: parseRecipientsFromScript(scriptContent),
    forwardingMode: detectForwardingMode(scriptContent)
  };
}

export async function uploadWorkerSecret(cloudflareConfig: CloudflareConfig, scriptName: string, secretName: string, secretValue: string): Promise<void> {
  const url = `${accountBaseUrl(cloudflareConfig.accountId)}/${scriptName}/secrets`;
  debugLog("Uploading worker secret %s for script %s", secretName, scriptName);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers(cloudflareConfig.apiToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({name: secretName, text: secretValue, type: "secret_text"})
  });

  const data: CloudflareResponse<{ name: string; type: string }> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to upload worker secret ${secretName} for ${scriptName}: ${errorMsg}`);
  }

  debugLog("Worker secret uploaded: %s for %s", secretName, scriptName);
}

function extractWorkerJsFromMultipart(raw: string): string {
  const firstLine = raw.split(/\r?\n/, 1)[0] || "";
  const boundaryMatch = firstLine.match(/^(--[^\r\n]+?)(--)?$/);
  if (!boundaryMatch) {
    return raw;
  }
  const boundary = boundaryMatch[1];
  const parts = raw.split(boundary);
  const workerPart = parts.find(part => /Content-Disposition:\s*form-data;\s*name="worker\.js"/i.test(part));
  if (!workerPart) {
    return raw;
  }
  const separator = workerPart.search(/\r?\n\r?\n/);
  if (separator < 0) {
    return raw;
  }
  const afterHeaders = workerPart.slice(separator).replace(/^\r?\n\r?\n/, "");
  return afterHeaders.replace(/\r?\n--\s*$/, "").replace(/\s+$/, "");
}

function normalizeForCompare(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\s+$/, "");
}

export function scriptsMatchIgnoringWhitespace(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

export function firstDifference(a: string, b: string): { index: number; aAround: string; bAround: string } | null {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === nb) return null;
  const maxLen = Math.max(na.length, nb.length);
  const indices = Array.from({ length: maxLen }, (_, i) => i);
  const diffIdx = indices.find(i => na[i] !== nb[i]) ?? Math.min(na.length, nb.length);
  const start = Math.max(0, diffIdx - 40);
  const end = diffIdx + 40;
  return {
    index: diffIdx,
    aAround: JSON.stringify(na.slice(start, end)),
    bAround: JSON.stringify(nb.slice(start, end))
  };
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

  const raw = await response.text();
  return extractWorkerJsFromMultipart(raw);
}
