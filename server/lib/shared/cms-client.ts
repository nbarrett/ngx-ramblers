import debug from "debug";
import { envConfig } from "../env-config/env-config";
import type { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import type { AuthResponse } from "../../../projects/ngx-ramblers/src/app/models/auth-data.model";
import { pluraliseWithCount } from "./string-utils";
import { isArray, keys } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("shared:cms-client"));
debugLog.enabled = true;

export interface CMSAuth {
  baseUrl: string;
  authToken: string;
}

function decodeToken(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const payload = Buffer.from(parts[1], "base64").toString("utf-8");
  return JSON.parse(payload);
}

function authHeaders(auth: CMSAuth): Record<string, string> {
  return {
    "Authorization": `Bearer ${auth.authToken}`,
    "Content-Type": "application/json"
  };
}

export async function login(baseUrl: string, username: string, password: string): Promise<CMSAuth> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBaseUrl}/api/database/auth/login`;

  debugLog(`Logging in as ${username}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({userName: username, password})
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: AuthResponse = await response.json();

  debugLog("Login response:", JSON.stringify(data, null, 2));

  if (!data.tokens || !data.tokens.auth) {
    const receivedKeys = keys(data || {}).join(", ");
    throw new Error(`Login response did not contain auth token. Received fields: ${receivedKeys}`);
  }

  if (!data.loginResponse) {
    throw new Error("Login response did not contain loginResponse");
  }

  if (!data.loginResponse.memberLoggedIn) {
    throw new Error(`Login failed: ${data.loginResponse.alertMessage || "Member not logged in"}`);
  }

  const tokenPayload = decodeToken(data.tokens.auth);
  if (!tokenPayload.contentAdmin) {
    throw new Error(`User ${username} does not have contentAdmin permission`);
  }

  debugLog("Login successful");

  return {
    baseUrl: normalizedBaseUrl,
    authToken: data.tokens.auth
  };
}

export async function pageContent(auth: CMSAuth, path: string): Promise<PageContent | null> {
  const criteria = { path: { $eq: path } };
  const url = `${auth.baseUrl}/api/database/page-content?criteria=${encodeURIComponent(JSON.stringify(criteria))}`;

  debugLog(`Fetching page content for path: ${path}`);

  const response = await fetch(url, {
    headers: authHeaders(auth)
  });

  if (response.status === 404) {
    debugLog(`Page not found: ${path}`);
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch page content: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  let result: PageContent | null = null;

  if (data.action === "query" && data.response) {
    result = {
      id: data.response.id,
      path: data.response.path,
      rows: data.response.rows || []
    };
  } else if (isArray(data) && data.length > 0) {
    result = data[0];
  } else if (data && !isArray(data)) {
    result = data;
  }

  if (result && result.path !== path) {
    debugLog(`Warning: API returned different path. Requested: ${path}, Got: ${result.path}`);
    return null;
  }

  if (result) {
    debugLog(`Retrieved page: ${path} (${pluraliseWithCount(result.rows?.length || 0, "row")})`);
  }

  return result;
}

export async function createPageContent(auth: CMSAuth, content: PageContent): Promise<PageContent> {
  const url = `${auth.baseUrl}/api/database/page-content`;

  debugLog(`Creating page content for path: ${content.path}`);

  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(auth),
    body: JSON.stringify(content)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create page content: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  debugLog(`Created page: ${content.path}`);
  return data;
}

export async function updatePageContent(auth: CMSAuth, id: string, content: PageContent): Promise<PageContent> {
  const url = `${auth.baseUrl}/api/database/page-content/${id}`;
  const payload = { ...content, id };

  debugLog(`Updating page content: ${id} (${content.path})`);

  const response = await fetch(url, {
    method: "PUT",
    headers: authHeaders(auth),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update page content: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  debugLog(`Updated page: ${content.path}`);
  return data;
}

export async function pageExists(auth: CMSAuth, path: string): Promise<boolean> {
  const page = await pageContent(auth, path);
  return page !== null;
}

export async function createOrUpdatePageContent(auth: CMSAuth, content: PageContent): Promise<PageContent> {
  const existing = await pageContent(auth, content.path!);

  if (existing) {
    return updatePageContent(auth, existing.id!, content);
  }

  return createPageContent(auth, content);
}

export async function deletePageContent(auth: CMSAuth, id: string): Promise<void> {
  const url = `${auth.baseUrl}/api/database/page-content/${id}`;

  debugLog(`Deleting page content: ${id}`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(auth)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete page content: ${response.status} ${response.statusText} - ${errorText}`);
  }

  debugLog(`Deleted page: ${id}`);
}

export async function fetchAllPages(auth: CMSAuth): Promise<PageContent[]> {
  const url = `${auth.baseUrl}/api/database/page-content/all`;

  debugLog(`Fetching all pages from: ${auth.baseUrl}`);

  const response = await fetch(url, {
    headers: authHeaders(auth)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch all pages: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const pages = data.response || data || [];

  debugLog(`Found ${pages.length} pages`);
  return pages;
}

export async function fetchAllWalks(baseUrl: string): Promise<any[]> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBaseUrl}/api/database/group-event/all`;

  debugLog(`Fetching all walks from: ${normalizedBaseUrl}`);

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    debugLog(`Failed to fetch walks: ${response.status}`);
    return [];
  }

  const data = await response.json();
  const walks = data.response || data || [];

  debugLog(`Found ${walks.length} walks`);
  return walks;
}
