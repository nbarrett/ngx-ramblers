import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import uniq from "lodash-es/uniq";
import { NgxLoggerLevel } from "ngx-logger";
import { DataQueryOptions } from "../models/api-request.model";
import { AlbumPath, PageContent, PageContentApiResponse } from "../models/content-text.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { MemberLoginService } from "./member/member-login.service";
import { PageContentActionsService } from "./page-content-actions.service";
import { sortBy } from "../functions/arrays";
import { uniqBy } from "lodash-es";

@Injectable({
  providedIn: "root"
})
export class PageContentService {
  private logger: Logger;
  private BASE_URL = "/api/database/page-content";
  public siteLinks: string[] = [];

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              private pageContentActionsService: PageContentActionsService,
              public memberLoginService: MemberLoginService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PageContentService, NgxLoggerLevel.OFF);
    this.refreshLookups();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<PageContent[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<PageContentApiResponse>(`${this.BASE_URL}/all`, {params}));
    return apiResponse.response as PageContent[];
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

  public async albumNames(): Promise<AlbumPath[]> {
    const results: PageContent[] = await this.all();
    const albumPaths: AlbumPath[] = results.map(pageContent => pageContent.rows.filter(row => this.pageContentActionsService.isCarouselOrAlbum(row)).map(row => ({
      contentPath: pageContent.path,
      albumName: row.carousel.name
    }))).flat(2).sort(sortBy("contentPath", "name"));
    const albums = uniqBy(albumPaths, (albumPath: AlbumPath) => albumPath.albumName + albumPath.contentPath);
    this.logger.info("given:", results, "albumNames:", albums);
    return albums;
  }

  refreshLookups() {
    if (this.memberLoginService.allowContentEdits()) {
      return this.all().then(response => {
        this.siteLinks = uniq(response.map(item => item.path)).sort();
        this.logger.info("siteLinks:", this.siteLinks);
      });
    } else {
      return Promise.resolve();
    }
  }

}
