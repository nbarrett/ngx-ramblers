import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import {
  MailchimpCampaignContentUpdateRequest,
  MailchimpCampaignListRequest,
  MailchimpCampaignListResponse,
  MailchimpCampaignReplicateIdentifiersResponse,
  MailchimpCampaignReplicateResponse,
  MailchimpCampaignSearchRequest,
  MailchimpCampaignSearchResponse,
  MailchimpCampaignSendRequest,
  MailchimpCampaignSendResponse,
  MailchimpCampaignUpdateRequest,
  MailchimpConfig,
  MailchimpExpenseOtherContent,
  MailchimpGenericOtherContent,
  MailchimpSetContentResponse
} from "../../models/mailchimp.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailchimpConfigService } from "../mailchimp-config.service";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpCampaignService {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpCampaignService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private http = inject(HttpClient);
  private mailchimpConfigService = inject(MailchimpConfigService);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/mailchimp/campaigns";
  private campaignNotifications = new Subject<ApiResponse>();
  private mailchimpConfig: MailchimpConfig;

  constructor() {
    this.mailchimpConfigService.getConfig().then(response => this.mailchimpConfig = response);
  }

  async addCampaign(campaignId, campaignName) {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${campaignId}/campaignAdd`, {campaignName}), this.campaignNotifications)).response;
  }

  async deleteCampaign(campaignId) {
    return (await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/${campaignId}/delete`), this.campaignNotifications)).response;
  }

  async getContent(campaignId) {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/${campaignId}/content`), this.campaignNotifications)).response;
  }

  async list(options: MailchimpCampaignListRequest): Promise<MailchimpCampaignListResponse> {
    const params: HttpParams = this.commonDataService.toHttpParams(options);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/list`, {params}), this.campaignNotifications)).response;
  }

  async search(options: MailchimpCampaignSearchRequest): Promise<MailchimpCampaignSearchResponse> {
    const params: HttpParams = this.commonDataService.toHttpParams(options);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/search`, {params}), this.campaignNotifications)).response;
  }

  async setContent(templateId: number, campaignId: string, contentSections: MailchimpExpenseOtherContent | MailchimpGenericOtherContent): Promise<MailchimpSetContentResponse | void> {
    this.logger.debug("setContent:contentSections", contentSections);
    if (contentSections) {
      const updateRequest: MailchimpCampaignContentUpdateRequest = {
        template: {id: templateId, sections: contentSections.sections}
      };
      return await this.updateCampaignContent(campaignId, updateRequest);
    } else {
      return Promise.resolve();
    }
  }

  private async updateCampaignContent(campaignId, body: MailchimpCampaignContentUpdateRequest) {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${campaignId}/content`, body), this.campaignNotifications);
    return apiResponse.error ? Promise.reject("campaign content sections update failed due to error: " + this.stringUtils.stringifyObject(apiResponse.error)) : apiResponse.response;
  }

  private async updateCampaign(campaignId, body: MailchimpCampaignUpdateRequest) {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${campaignId}/update`, body), this.campaignNotifications);
    return apiResponse.error ? Promise.reject("campaign update failed due to error: " + this.stringUtils.stringifyObject(apiResponse.error)) : apiResponse.response;
  }

  async replicateCampaign(campaignId): Promise<MailchimpCampaignReplicateResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${campaignId}/replicate`, {}), this.campaignNotifications)).response;
  }

  async sendCampaign(campaignId: string): Promise<MailchimpCampaignSendResponse> {
    if (!this.mailchimpConfig?.mailchimpEnabled) {
      return Promise.resolve({complete: false});
    } else if (!this.mailchimpConfig?.allowSendCampaign) {
      const reason = "You cannot send campaigns as sending has been disabled by configuration";
      return Promise.reject(reason);
    } else {
      return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${campaignId}/send`, {}), this.campaignNotifications)).response;
    }
  }

  replicateAndSendWithOptions(campaignRequest: MailchimpCampaignSendRequest): Promise<MailchimpCampaignReplicateIdentifiersResponse> {
    if (!this.mailchimpConfig?.mailchimpEnabled) {
      return Promise.resolve({complete: false});
    } else {
      this.logger.info("about to replicate campaign with campaignRequest:", campaignRequest);
      return this.replicateCampaign(campaignRequest.campaignId)
        .then((replicateCampaignResponse: MailchimpCampaignReplicateResponse) => {

            const updateRequest: MailchimpCampaignUpdateRequest = {
              recipients: {
                segment_opts: {
                  saved_segment_id: campaignRequest.segmentId,
                },
                list_id: campaignRequest?.otherOptions?.list_id,
              },
              settings: {
                title: campaignRequest?.campaignName.substring(0, 99),
                subject_line: campaignRequest?.campaignName,
                from_name: campaignRequest?.otherOptions?.from_name,
                reply_to: campaignRequest?.otherOptions?.from_email
              }
            };

            return this.updateCampaign(replicateCampaignResponse.id, updateRequest)
              .then(() => this.setContent(replicateCampaignResponse.settings.template_id, replicateCampaignResponse.id, campaignRequest.contentSections)
                .then(() =>
                  campaignRequest.dontSend ? Promise.resolve({complete: false, web_id: replicateCampaignResponse.web_id}) :
                    this.sendCampaign(replicateCampaignResponse.id)
                      .then((sendCampaignResponse) => ({...sendCampaignResponse, ...{web_id: replicateCampaignResponse.web_id}}))));
          }
        );
    }
  }
}
