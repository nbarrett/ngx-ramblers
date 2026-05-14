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

export async function groupEventsByCriteria(baseUrl: string, criteria: any): Promise<any[]> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBaseUrl}/api/database/group-event/all?criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
  const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    throw new Error(`groupEventsByCriteria failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.response || data || [];
}

export async function groupEventBySlug(baseUrl: string, slug: string): Promise<any | null> {
  const events = await groupEventsByCriteria(baseUrl, { "groupEvent.url": { $regex: slug, $options: "i" } });
  return events[0] || null;
}

export async function groupEventsByDate(baseUrl: string, isoDate: string): Promise<any[]> {
  const start = new Date(`${isoDate}T00:00:00+00:00`).toISOString().replace("Z", "+00:00");
  const end = new Date(new Date(`${isoDate}T00:00:00+00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString().replace("Z", "+00:00");
  return groupEventsByCriteria(baseUrl, { "groupEvent.start_date_time": { $gte: start, $lt: end } });
}

export async function contentMetadataByName(auth: CMSAuth, name: string): Promise<any | null> {
  const criteria = { name: { $eq: name } };
  const url = `${auth.baseUrl}/api/database/content-metadata/all?criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
  const response = await fetch(url, { headers: authHeaders(auth) });
  if (!response.ok) {
    throw new Error(`contentMetadataByName failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const records = data.response || data || [];
  return records[0] || null;
}

export async function createOrUpdateContentMetadata(auth: CMSAuth, body: any): Promise<any> {
  const existing = await contentMetadataByName(auth, body.name);
  if (existing) {
    const id = existing.id || existing._id;
    const url = `${auth.baseUrl}/api/database/content-metadata/${id}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: authHeaders(auth),
      body: JSON.stringify({ ...body, id })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`createOrUpdateContentMetadata PUT failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    return data.response || data;
  }
  const response = await fetch(`${auth.baseUrl}/api/database/content-metadata`, {
    method: "POST",
    headers: authHeaders(auth),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`createOrUpdateContentMetadata POST failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const data = await response.json();
  return data.response || data;
}

export async function uploadFileToS3(auth: CMSAuth, bytes: Buffer, filename: string, rootFolder: string): Promise<string> {
  const url = `${auth.baseUrl}/api/aws/s3/file-upload?root-folder=${encodeURIComponent(rootFolder)}`;
  const form = new FormData();
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
  form.append("file", blob, filename);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${auth.authToken}` },
    body: form as any
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`uploadFileToS3 failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const data = await response.json();
  const fromResponses = Array.isArray(data?.responses) ? data.responses[0]?.fileNameData?.awsFileName : undefined;
  const name = fromResponses || data.response?.fileNameData?.awsFileName || data.fileNameData?.awsFileName || data.awsFileName || data.fileName;
  if (!name) throw new Error(`uploadFileToS3: could not extract awsFileName from response: ${JSON.stringify(data).slice(0, 300)}`);
  return name;
}
