import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import {
  InboxAliasConfigView,
  InboxAccessMode,
  InboxImportAllResponse,
  InboxMailboxConnectionView,
  InboxRescanGeneralResponse,
  InboxPushConfigResponse,
  InboxReplyComposeRequest,
  InboxReplyComposeResponse,
  InboxSyncMode,
  InboxThreadFolder,
  InboxThreadListResponse,
  InboxThreadMessagesResponse,
  InboxUnreadCountsResponse,
  InboxViewScope
} from "../../models/inbox.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { CommonDataService } from "../common-data-service";

@Injectable({
  providedIn: "root"
})
export class InboxService {

  private logger: Logger = inject(LoggerFactory).createLogger("InboxService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/inbox";

  async listAliases(): Promise<InboxAliasConfigView[]> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/aliases`));
    return response.response as InboxAliasConfigView[];
  }

  async mailboxConnections(): Promise<InboxMailboxConnectionView[]> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/mailbox-connections`));
    return response.response as InboxMailboxConnectionView[];
  }

  async createMailboxConnection(): Promise<InboxMailboxConnectionView> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/mailbox-connections`, {}));
    return response.response as InboxMailboxConnectionView;
  }

  async deleteMailboxConnection(mailboxConnectionId: string): Promise<number> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/mailbox-connections/${mailboxConnectionId}`));
    return (response.response as { deletedCount: number }).deletedCount;
  }

  async updateAccessMode(mailboxConnectionId: string, accessMode: InboxAccessMode): Promise<InboxMailboxConnectionView> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.BASE_URL}/mailbox-connections/${mailboxConnectionId}/access-mode`, {accessMode}));
    return response.response as InboxMailboxConnectionView;
  }

  async updateSyncMode(mailboxConnectionId: string, syncMode: InboxSyncMode, pubsubTopicName: string | null = null): Promise<InboxMailboxConnectionView> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.BASE_URL}/mailbox-connections/${mailboxConnectionId}/sync-mode`, {syncMode, pubsubTopicName}));
    return response.response as InboxMailboxConnectionView;
  }

  async updateImportAllMessages(mailboxConnectionId: string, importAllMessages: boolean): Promise<InboxImportAllResponse> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.BASE_URL}/mailbox-connections/${mailboxConnectionId}/import-all`, {importAllMessages}));
    return response.response as InboxImportAllResponse;
  }

  async rescanGeneralMailbox(mailboxConnectionId: string): Promise<InboxRescanGeneralResponse> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/mailbox-connections/${mailboxConnectionId}/rescan-general`, {}));
    return response.response as InboxRescanGeneralResponse;
  }

  async startGoogleCloudSetup(projectId: string, topicName: string, subscriptionName?: string): Promise<string> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/oauth/setup/start`, {projectId, topicName, subscriptionName}));
    return (response.response as {consentUrl: string}).consentUrl;
  }

  async pushConfig(): Promise<InboxPushConfigResponse> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/pubsub/push-config`));
    return response.response as InboxPushConfigResponse;
  }

  async unreadCounts(): Promise<InboxUnreadCountsResponse> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/unread-counts`));
    return response.response as InboxUnreadCountsResponse;
  }

  async startOauth(mailboxConnectionId: string): Promise<string> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/oauth/start?mailboxConnectionId=${encodeURIComponent(mailboxConnectionId)}`));
    return (response.response as { consentUrl: string }).consentUrl;
  }

  async syncConnection(mailboxConnectionId: string): Promise<number> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/mailbox-connections/${mailboxConnectionId}/sync`, {}));
    return (response.response as { importedCount: number }).importedCount;
  }

  async listThreads(roleType: string | null = null, scope: InboxViewScope | null = null, unreadOnly: boolean = false, limit: number | null = null, folder: InboxThreadFolder | null = null): Promise<InboxThreadListResponse> {
    const params: string[] = [];
    if (folder) {
      params.push(`folder=${encodeURIComponent(folder)}`);
    }
    if (roleType) {
      params.push(`roleType=${encodeURIComponent(roleType)}`);
    }
    if (scope) {
      params.push(`scope=${encodeURIComponent(scope)}`);
    }
    if (unreadOnly) {
      params.push("unreadOnly=true");
    }
    if (limit) {
      params.push(`limit=${limit}`);
    }
    const query = params.length > 0 ? `?${params.join("&")}` : "";
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/threads${query}`));
    return response.response as InboxThreadListResponse;
  }

  async getThread(threadId: string): Promise<InboxThreadMessagesResponse> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/threads/${threadId}`));
    return response.response as InboxThreadMessagesResponse;
  }

  async markThreadRead(threadId: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/threads/${threadId}/mark-read`, {}));
  }

  async markThreadUnread(threadId: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/threads/${threadId}/mark-unread`, {}));
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/threads/${threadId}`));
  }

  async moveThreadToInbox(threadId: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/threads/${threadId}/move-to-inbox`, {}));
  }

  async composeReply(threadId: string, request: InboxReplyComposeRequest): Promise<InboxReplyComposeResponse> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/threads/${threadId}/compose-reply`, request));
    return response.response as InboxReplyComposeResponse;
  }
}
