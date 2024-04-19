import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import {
  Account,
  ContactsAddOrRemoveFromListRequest,
  ContactsListResponse,
  ListCreateRequest,
  ListsResponse,
  MailIdentifiers,
  MailTemplates,
  SendSmtpEmailRequest,
  TemplateOptions,
  ContactAddOrRemoveFromListResponse,
  CreateContactRequest,
  ContactCreatedResponse,
  FoldersListResponse,
  ListCreateResponse
} from "../../models/mail.model";
import { AlertInstance } from "../notifier.service";

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

  async contactsInList(listType: string, notify: AlertInstance): Promise<ContactsListResponse> {
    const params = this.commonDataService.toHttpParams({listType});
    notify.success({title: "Mail Lists", message: `Querying Mail for current ${listType} subscribers`});
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/contacts-in-list`, {params}))).response;
  }

  async createContacts(createContactRequests: CreateContactRequest[]): Promise<ContactCreatedResponse[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/create`, createContactRequests))).response;
  }

  async contactsAddToList(listType: string, createContactRequests: CreateContactRequest[]): Promise<any> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/add-to-list`, createContactRequests))).response;
  }

  async contactsBatchUpdate(listType: string, createContactRequests: CreateContactRequest[]): Promise<any> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/batch-update`, createContactRequests))).response;
  }

  async contactsRemoveFromList(contactRemoveFromListRequest: ContactsAddOrRemoveFromListRequest): Promise<ContactAddOrRemoveFromListResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/contacts/remove-from-list`, contactRemoveFromListRequest))).response;
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

  async queryAccount(): Promise<Account> {
    this.logger.info("queryAccount");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/account`))).response;
  }

  async queryTemplates(templateOptions?: TemplateOptions): Promise<MailTemplates> {
    this.logger.info("template list templateOptions:", templateOptions);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates`, templateOptions))).response;
  }

}
