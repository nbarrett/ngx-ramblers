import debug from "debug";
import type { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import type { AuthResponse } from "../../../projects/ngx-ramblers/src/app/models/auth-data.model";
import { pluraliseWithCount } from "../shared/string-utils";

const debugLog = debug("release-notes:cms-client");
debugLog.enabled = true;

export class CMSClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async login(username: string, password: string): Promise<void> {
    const url = `${this.baseUrl}/api/database/auth/login`;

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
      const receivedKeys = Object.keys(data || {}).join(", ");
      throw new Error(`Login response did not contain auth token. Received fields: ${receivedKeys}`);
    }

    if (!data.loginResponse) {
      throw new Error("Login response did not contain loginResponse");
    }

    if (!data.loginResponse.memberLoggedIn) {
      throw new Error(`Login failed: ${data.loginResponse.alertMessage || "Member not logged in"}`);
    }

    const tokenPayload = this.decodeToken(data.tokens.auth);
    if (!tokenPayload.contentAdmin) {
      throw new Error(`User ${username} does not have contentAdmin permission`);
    }

    this.authToken = data.tokens.auth;
    debugLog("Login successful");
  }

  private decodeToken(token: string): any {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }
      const payload = Buffer.from(parts[1], "base64").toString("utf-8");
      return JSON.parse(payload);
    } catch (error) {
      throw new Error(`Failed to decode token: ${error}`);
    }
  }

  private ensureAuthenticated(): void {
    if (!this.authToken) {
      throw new Error("Not authenticated. Call login() first.");
    }
  }

  private authHeaders(): Record<string, string> {
    this.ensureAuthenticated();
    return {
      "Authorization": `Bearer ${this.authToken}`,
      "Content-Type": "application/json"
    };
  }

  async pageContent(path: string): Promise<PageContent | null> {
    this.ensureAuthenticated();

    const criteria = { path: { $eq: path } };
    const url = `${this.baseUrl}/api/database/page-content?criteria=${encodeURIComponent(JSON.stringify(criteria))}`;

    debugLog(`Fetching page content for path: ${path}`);

    const response = await fetch(url, {
      headers: this.authHeaders()
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

    let pageContent: PageContent | null = null;

    if (data.action === "query" && data.response) {
      pageContent = {
        id: data.response.id,
        path: data.response.path,
        rows: data.response.rows || []
      };
    } else if (Array.isArray(data) && data.length > 0) {
      pageContent = data[0];
    } else if (data && !Array.isArray(data)) {
      pageContent = data;
    }

    if (pageContent && pageContent.path !== path) {
      debugLog(`Warning: API returned different path. Requested: ${path}, Got: ${pageContent.path}`);
      return null;
    }

    if (pageContent) {
      debugLog(`Retrieved page: ${path} (${pluraliseWithCount(pageContent.rows?.length || 0, "row")})`);
    }

    return pageContent;
  }

  async createPageContent(content: PageContent): Promise<PageContent> {
    this.ensureAuthenticated();

    const url = `${this.baseUrl}/api/database/page-content`;

    debugLog(`Creating page content for path: ${content.path}`);

    const response = await fetch(url, {
      method: "POST",
      headers: this.authHeaders(),
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

  async updatePageContent(id: string, content: PageContent): Promise<PageContent> {
    this.ensureAuthenticated();

    const url = `${this.baseUrl}/api/database/page-content/${id}`;
    const payload: PageContent = {
      ...content,
      id
    };

    debugLog(`Updating page content: ${id} (${content.path})`);

    const response = await fetch(url, {
      method: "PUT",
      headers: this.authHeaders(),
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

  async createOrUpdatePageContent(content: PageContent): Promise<PageContent> {
    const existing = await this.pageContent(content.path!);

    if (existing) {
      return this.updatePageContent(existing.id!, content);
    }

    return this.createPageContent(content);
  }
}
