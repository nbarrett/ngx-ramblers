import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import uniq from "lodash-es/uniq";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../auth/auth.service";
import { DataQueryOptions } from "../models/api-request.model";
import { PageContent } from "../models/content-text.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { MemberLoginService } from "./member/member-login.service";
import { ContentMetadataService } from "./content-metadata.service";
import { RootFolder } from "../models/system.model";

@Injectable({
  providedIn: "root"
})
export class PageContentService {
  private logger: Logger;
  private BASE_URL = "/api/database/page-content";
  public siteLinks: string[] = [];
  carousels: string[] = [];

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              private authService: AuthService,
              private contentMetadataService: ContentMetadataService,
              public memberLoginService: MemberLoginService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PageContentService, NgxLoggerLevel.OFF);
    this.refreshLookups();
  }

  async all(): Promise<PageContent[]> {
    const apiResponse = await this.http.get<{ response: PageContent[] }>(`${this.BASE_URL}/all`).toPromise();
    this.logger.debug("all - received", apiResponse);
    return apiResponse.response;
  }

  async allReferringPages(path: string): Promise<PageContent[]> {
    const dataQueryOptions: DataQueryOptions = {criteria: {"rows.columns.href": {$regex: path, $options: "i"}}};
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    const apiResponse = await this.http.get<{ response: PageContent[] }>(`${this.BASE_URL}/all`, {params}).toPromise();
    this.logger.debug("all - received", apiResponse);
    return apiResponse.response;
  }

  async findByPath(path: string): Promise<PageContent> {
    const dataQueryOptions: DataQueryOptions = {criteria: {path: {$eq: path}}};
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    const apiResponse = await this.http.get<{ response: PageContent }>(this.BASE_URL, {params}).toPromise();
    this.logger.debug("for path", path, "- received", apiResponse);
    return apiResponse.response;
  }

  async create(pageContent: PageContent): Promise<PageContent> {
    this.logger.debug("creating", pageContent);
    const apiResponse = await this.http.post<{ response: PageContent }>(this.BASE_URL, pageContent).toPromise();
    this.logger.debug("created", pageContent, "- received", apiResponse);
    return apiResponse.response;
  }

  async update(pageContent: PageContent): Promise<PageContent> {
    this.logger.debug("updating", pageContent);
    const apiResponse = await this.http.put<{ response: PageContent }>(`${this.BASE_URL}/${pageContent.id}`, pageContent).toPromise();
    this.logger.debug("updated", pageContent, "- received", apiResponse);
    return apiResponse.response;
  }

  async createOrUpdate(pageContent: PageContent): Promise<PageContent> {
    if (pageContent.id) {
      return this.update(pageContent);
    } else {
      return this.create(pageContent);
    }
  }

  async delete(pageContent: PageContent): Promise<PageContent> {
    const apiResponse = await this.http.delete<{ response: PageContent }>(`${this.BASE_URL}/${pageContent.id}`).toPromise();
    this.logger.debug("delete", pageContent, "- received", apiResponse);
    return apiResponse.response;
  }

  refreshLookups() {
    if (this.memberLoginService.allowContentEdits()) {
      this.contentMetadataService.all().then(items => {
        this.carousels = items.filter(content => content.rootFolder === RootFolder.carousels)
          .map(content => content.name).sort();
      });
      this.all().then(response => {
        this.siteLinks = uniq(response.map(item => item.path)).sort();
        this.logger.info("siteLinks:", this.siteLinks);
      });
    }
  }
}
