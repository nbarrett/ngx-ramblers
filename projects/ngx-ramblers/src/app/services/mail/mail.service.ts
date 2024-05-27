import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import {
  Account,
  ContactAddOrRemoveResponse,
  ContactCreatedResponse,
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
  SendSmtpEmailRequest,
  StatusMappedResponseMultipleInputs,
  StatusMappedResponseSingleInput,
  TemplateOptions
} from "../../models/mail.model";

@Injectable({
  providedIn: "root"
})
export class MailService {
  private readonly logger: Logger;
  private BASE_URL = "api/mail";

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("TransactionalMailService", NgxLoggerLevel.OFF);
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

  async queryTemplates(templateOptions?: TemplateOptions): Promise<MailTemplates> {
    this.logger.info("template list templateOptions:", templateOptions);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates`, templateOptions))).response;
  }

  async querySegments(): Promise<MailTemplates> {
    this.logger.info("querySegments");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/templates`))).response;
  }

}
