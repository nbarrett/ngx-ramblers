import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom } from "rxjs";
import { pickBy } from "es-toolkit/compat";
import { ApiResponse } from "../../models/api-response.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import {
  Account,
  BrevoCampaignContent,
  CampaignRecipientsReport,
  BrevoTransactionalAggregatedReport,
  ContactAddOrRemoveResponse,
  ContactCreatedResponse,
  ContactUpdateRequest,
  ContactsAddOrRemoveRequest,
  ContactsDeleteRequest,
  ContactsListResponse,
  CreateCampaignRequest,
  CreateContactRequest,
  CreateContactRequestWithObjectAttributes,
  CreateSenderResponse,
  FoldersListResponse,
  ListCreateRequest,
  ListCreateResponse,
  ListsResponse,
  ListUpdateRequest,
  MailIdentifiers,
  MailTemplates,
  SendCampaignRequest,
  Sender,
  SendersResponse,
  SwitchSendingDomainResponse,
  ForgotPasswordEmailRequest,
  ForgotPasswordEmailResponse,
  SendSmtpEmailRequest,
  StatusMappedResponseMultipleInputs,
  StatusMappedResponseSingleInput,
  TemplateRenderRequest,
  TemplateRenderResponse,
  EditableBodyRequest,
  EditableBodyResponse,
  TemplateDiffRequest,
  TemplateDiffResponse,
  LocalTemplateContentResponse,
  TemplateOptions,
  BrevoDomainInfo,
  BrevoDomainConfiguration,
  DomainRegistrationResult,
  DomainAuthenticationResult,
  BlockedContactsRequest,
  BlockedContactsResponse,
  ClearAllBlocklistResult,
  UnsubscribeActivityResponse,
  UnsubscribeHistoryEntry,
  BrevoTransactionalEmailListResponse
} from "../../models/mail.model";
import { BrevoCampaignProgress, BrevoCampaignQueueSummary } from "../../models/brevo-campaign-queue.model";
import { SortDirection } from "../../models/sort.model";

@Injectable({
  providedIn: "root"
})
export class MailService {

  private logger: Logger = inject(LoggerFactory).createLogger("MailService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/mail";

  async campaignQueueSummary(startDate?: string, endDate?: string): Promise<BrevoCampaignQueueSummary> {
    const params = startDate || endDate
      ? this.commonDataService.toHttpParams({startDate, endDate})
      : undefined;
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/campaign/queue`, {params}))).response;
  }

  async releaseCampaign(campaignId: number): Promise<BrevoCampaignQueueSummary> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/campaign/${campaignId}/release`, {}))).response;
  }

  async cancelCampaign(campaignId: number): Promise<BrevoCampaignQueueSummary> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/campaign/${campaignId}/cancel`, {}))).response;
  }

  async transactionalAggregatedReport(startDate: string, endDate: string): Promise<BrevoTransactionalAggregatedReport> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/transactional/aggregated-report`, {
      params: this.commonDataService.toHttpParams({startDate, endDate})
    }))).response;
  }

  async transactionalEmails(startDate: string, endDate: string): Promise<BrevoTransactionalEmailListResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/transactional/emails`, {
      params: this.commonDataService.toHttpParams({startDate, endDate, limit: 100})
    }))).response;
  }

  async campaignStats(campaignId: number): Promise<BrevoCampaignProgress> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/campaigns/${campaignId}/stats`, {}))).response;
  }

  async campaignRecipients(campaignId: number, type: string): Promise<CampaignRecipientsReport> {
    const params = this.commonDataService.toHttpParams(pickBy({type}));
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/campaigns/${campaignId}/recipients`, {params}))).response;
  }

  async campaignContent(campaignId: number): Promise<BrevoCampaignContent> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/campaigns/${campaignId}/content`, {}))).response;
  }

  async createList(listCreateRequest: ListCreateRequest): Promise<ListCreateResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/lists/create`, listCreateRequest))).response;
  }

  async updateList(listUpdateRequest: ListUpdateRequest): Promise<ListCreateResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/lists/update`, listUpdateRequest))).response;
  }

  async deleteList(listId: number): Promise<any> {
    const params = this.commonDataService.toHttpParams({listId});
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/lists/delete`, {params}))).response;
  }

  async addSegment(listType: string, segmentName: string): Promise<any> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/segmentAdd`, {listType, segmentName}))).response;
  }

  async addSegmentMembers(listType: string, segmentId: number, segmentMembers: MailIdentifiers[]): Promise<any> {
    const body: any = {
      listType,
      segmentId,
      membersToAdd: segmentMembers,
      membersToRemove: []
    };
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/segmentMembersAddOrRemove`, body))).response;
  }

  async addMergeField(listType: string, mergeField: any): Promise<any> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${listType}/addMergeField`, mergeField))).response;
  }

  async updateSegment(listType: string, segmentId: number, segmentName: string, resetSegmentMembers: boolean): Promise<any> {
    const body: any = {
      segmentId,
      segmentName,
      resetSegmentMembers
    };
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${listType}/segmentUpdate`, body))).response;
  }

  async deleteSegment(listType: string, segmentId: number): Promise<any> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/${listType}/segmentDel/${segmentId}`))).response;
  }

  async queryContacts(): Promise<ContactsListResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/contacts`))).response;
  }

  async createContacts(createContactRequests: CreateContactRequest[]): Promise<ContactCreatedResponse[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/create`, createContactRequests))).response;
  }

  async contactsBatchUpdate(createContactRequests: CreateContactRequestWithObjectAttributes[]): Promise<StatusMappedResponseMultipleInputs> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/batch-update`, createContactRequests))).response;
  }

  async updateContact(contactUpdateRequest: ContactUpdateRequest): Promise<any> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/update`, contactUpdateRequest))).response;
  }

  async contactsRemoveFromList(contactRemoveFromListRequest: ContactsAddOrRemoveRequest[]): Promise<ContactAddOrRemoveResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/remove-from-list`, contactRemoveFromListRequest))).response;
  }

  async deleteContacts(contactRemoveFromListRequest: ContactsDeleteRequest): Promise<StatusMappedResponseSingleInput[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/delete`, contactRemoveFromListRequest))).response;
  }

  async queryFolders(): Promise<FoldersListResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/folders`))).response;
  }

  async queryLists(): Promise<ListsResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/lists`))).response;
  }

  async sendTransactionalMessage(emailRequest: SendSmtpEmailRequest): Promise<void> {
    this.logger.info("sendMessage emailRequest:", emailRequest);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/transactional/send`, emailRequest))).response;
  }

  async sendForgotPasswordRequest(request: ForgotPasswordEmailRequest): Promise<ForgotPasswordEmailResponse> {
    this.logger.info("sendForgotPasswordRequest:", request);
    return firstValueFrom(this.http.post<ForgotPasswordEmailResponse>(`${this.BASE_URL}/transactional/forgot-password`, request));
  }

  async sendCampaign(createCampaignRequest: SendCampaignRequest): Promise<StatusMappedResponseSingleInput> {
    this.logger.info("sendCampaignMessage createCampaignRequest:", createCampaignRequest);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/campaign/send`, createCampaignRequest))).response;
  }

  async createCampaign(createCampaignRequest: CreateCampaignRequest): Promise<StatusMappedResponseSingleInput> {
    this.logger.info("sendCampaignMessage createCampaignRequest:", createCampaignRequest);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/campaign/create`, createCampaignRequest))).response;
  }

  async queryAccount(): Promise<Account> {
    this.logger.info("queryAccount");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/account`))).response;
  }

  async querySenders(): Promise<SendersResponse> {
    this.logger.info("querySenders");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/senders`))).response;
  }

  async createSender(sender: Sender): Promise<CreateSenderResponse> {
    this.logger.info("querySenders");
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/senders/create`, sender))).response;
  }

  async updateSender(senderId: number, sender: Sender): Promise<void> {
    this.logger.info("updateSender:", senderId, sender);
    return (await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.BASE_URL}/senders/${senderId}`, sender))).response;
  }

  async deleteSender(senderId: number): Promise<void> {
    this.logger.info("deleteSender:", senderId);
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/senders/${senderId}`))).response;
  }

  async queryTemplates(templateOptions?: TemplateOptions): Promise<MailTemplates> {
    this.logger.info("template list templateOptions:", templateOptions);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates`, templateOptions))).response;
  }

  async querySegments(): Promise<MailTemplates> {
    this.logger.info("querySegments");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/templates`))).response;
  }

  async templateDiff(request: TemplateDiffRequest): Promise<TemplateDiffResponse> {
    this.logger.info("templateDiff:", request);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates/diff`, request))).response;
  }

  async localTemplateContent(templateName: string): Promise<LocalTemplateContentResponse> {
    this.logger.info("localTemplateContent:", templateName);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates/local-content`, {templateName}))).response;
  }

  async queryLocalTemplateNames(): Promise<string[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/templates/local-names`))).response?.templateNames ?? [];
  }

  async renderTemplate(request: TemplateRenderRequest): Promise<TemplateRenderResponse> {
    this.logger.info("renderTemplate:", request);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates/render`, request))).response;
  }

  async editableBody(request: EditableBodyRequest): Promise<EditableBodyResponse> {
    this.logger.info("editableBody:", request);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates/editable-body`, request))).response;
  }

  async listDomains(): Promise<BrevoDomainInfo[]> {
    this.logger.info("listDomains");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/domains`))).response;
  }

  async registerDomain(name: string): Promise<DomainRegistrationResult> {
    this.logger.info("registerDomain:", name);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/domains/register`, {name}))).response;
  }

  async domainConfiguration(domainName: string): Promise<BrevoDomainConfiguration> {
    this.logger.info("domainConfiguration:", domainName);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/domains/configuration`, {params: {domainName}}))).response;
  }

  async authenticateDomain(domainName: string): Promise<DomainAuthenticationResult> {
    this.logger.info("authenticateDomain:", domainName);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/domains/authenticate`, {}, {params: {domainName}}))).response;
  }

  async switchSendingDomain(payload: { newHostname: string; oldHostname?: string; rewriteSenders?: boolean }): Promise<SwitchSendingDomainResponse> {
    this.logger.info("switchSendingDomain:", payload);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/domains/switch`, payload))).response as unknown as SwitchSendingDomainResponse;
  }

  async deleteDomain(domainName: string): Promise<void> {
    this.logger.info("deleteDomain:", domainName);
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/domains/delete`, {params: {domainName}}))).response;
  }

  async queryUnsubscribes(request?: BlockedContactsRequest): Promise<BlockedContactsResponse> {
    this.logger.info("queryUnsubscribes:", request);
    const params = this.commonDataService.toHttpParams(pickBy(request || {}, value => value !== undefined && value !== null && value !== ""));
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/unsubscribes`, {params}))).response;
  }

  async removeFromBlocklist(email: string): Promise<{ email: string; removed: boolean }> {
    this.logger.info("removeFromBlocklist:", email);
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/unsubscribes/${encodeURIComponent(email)}`))).response as unknown as { email: string; removed: boolean };
  }

  async clearAllBlocklist(): Promise<ClearAllBlocklistResult> {
    this.logger.info("clearAllBlocklist");
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/unsubscribes`))).response as unknown as ClearAllBlocklistResult;
  }

  async queryUnsubscribeActivity(request?: { limit?: number; offset?: number; sort?: SortDirection; startDate?: string; endDate?: string }): Promise<UnsubscribeActivityResponse> {
    this.logger.info("queryUnsubscribeActivity:", request);
    const params = this.commonDataService.toHttpParams(pickBy(request || {}, value => value !== undefined && value !== null));
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/unsubscribes/activity`, {params}))).response;
  }

  async queryUnsubscribeHistory(): Promise<UnsubscribeHistoryEntry[]> {
    this.logger.info("queryUnsubscribeHistory");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/unsubscribes/history`))).response as unknown as UnsubscribeHistoryEntry[];
  }

}
