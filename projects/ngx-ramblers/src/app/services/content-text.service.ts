import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { ContentText, ContentTextApiResponse } from "../models/content-text.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ContentTextService {
  private logger: Logger;
  private BASE_URL = "/api/database/content-text";
  private notificationsInternal = new Subject<ContentTextApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ContentTextService, NgxLoggerLevel.OFF);
  }

  notifications(): Observable<ContentTextApiResponse> {
    return this.notificationsInternal.asObservable();
  }

  async all(): Promise<ContentText[]> {
    const apiResponse = await this.http.get<{ response: ContentText[] }>(this.BASE_URL + "/all").toPromise();
    this.logger.debug("all - received", apiResponse);
    return apiResponse.response;
  }

  async getById(contentTextId: string): Promise<ContentText> {
    this.logger.debug("getById:", contentTextId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ContentTextApiResponse>(`${this.BASE_URL}/${contentTextId}`), this.notificationsInternal);
    return apiResponse.response as ContentText;
  }

  async findByNameAndCategory(name: string, category: string): Promise<ContentText> {
    const params = this.commonDataService.toHttpParams(category ? {criteria: {name: {$eq: name}, category: {$eq: category}}} : {criteria: {name: {$eq: name}}});
    const apiResponse = await this.http.get<{ response: ContentText }>(this.BASE_URL, {params}).toPromise();
    this.logger.debug("forName", name, "- received", apiResponse);
    return apiResponse.response;
  }

  async filterByCategory(category): Promise<ContentText[]> {
    const params = this.commonDataService.toHttpParams({criteria: {category: {$eq: category}}});
    const apiResponse = await this.http.get<{ response: ContentText[] }>(`${this.BASE_URL}/all`, {params}).toPromise();
    this.logger.debug("forName", category, "- received", apiResponse);
    return apiResponse.response;
  }

  async create(contentText: ContentText): Promise<ContentText> {
    this.logger.debug("creating", contentText);
    const apiResponse = await this.http.post<{ response: ContentText }>(this.BASE_URL, contentText).toPromise();
    this.logger.debug("created", contentText, "- received", apiResponse);
    return apiResponse.response;
  }

  async update(contentText: ContentText): Promise<ContentText> {
    this.logger.debug("updating", contentText);
    const apiResponse = await this.http.put<{ response: ContentText }>(this.BASE_URL + "/" + contentText.id, contentText).toPromise();
    this.logger.debug("updated", contentText, "- received", apiResponse);
    return apiResponse.response;
  }

  async createOrUpdate(contentText: ContentText): Promise<ContentText> {
    if (contentText.id) {
      return this.update(contentText);
    } else {
      return this.create(contentText);
    }
  }

  async delete(contentText: ContentText): Promise<ContentText> {
    const apiResponse = await this.http.delete<{ response: ContentText }>(this.BASE_URL + "/" + contentText.id).toPromise();
    this.logger.debug("delete", contentText, "- received", apiResponse);
    return apiResponse.response;
  }

}
