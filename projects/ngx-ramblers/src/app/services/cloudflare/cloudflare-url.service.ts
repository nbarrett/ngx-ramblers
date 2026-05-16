import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root"
})
export class CloudflareUrlService {

  private readonly base = "https://dash.cloudflare.com";

  dashboard(): string {
    return this.base;
  }

  apiTokens(): string {
    return `${this.base}/profile/api-tokens`;
  }

  webAnalyticsSites(accountId: string): string {
    return `${this.base}/${accountId}/web-analytics/sites`;
  }

  webAnalyticsSite(accountId: string, siteTag: string): string {
    return `${this.base}/${accountId}/web-analytics/edit/${siteTag}`;
  }

  emailRoutingOverview(accountId: string, baseDomain: string): string {
    return `${this.base}/${accountId}/${baseDomain}/email/routing/overview`;
  }

  emailRoutingRules(accountId: string, zoneId: string): string {
    return `${this.base}/${accountId}/email-service/routing/${zoneId}/routing-rules`;
  }

  worker(accountId: string, scriptName: string): string {
    return `${this.base}/${accountId}/workers/services/view/${scriptName}/production`;
  }
}
