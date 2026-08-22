import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { CommitteeFile, CommitteeFileApiResponse } from "../../models/committee.model";
import { PageContent, PageContentType } from "../../models/content-text.model";
import { UIDateFormat } from "../../models/date-format.model";
import { CommonDataService } from "../common-data-service";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { PageContentService } from "../page-content.service";

@Injectable({
  providedIn: "root"
})
export class CommitteeFileService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeFileService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private pageContentService = inject(PageContentService);
  private dateUtils = inject(DateUtilsService);
  private BASE_URL = "/api/database/committee-file";
  private committeeFileNotifications = new Subject<CommitteeFileApiResponse>();

  notifications(): Observable<CommitteeFileApiResponse> {
    return this.committeeFileNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<CommitteeFile[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.info("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<CommitteeFileApiResponse>(`${this.BASE_URL}/all`, {params}), this.committeeFileNotifications);
    return apiResponse.response as CommitteeFile[];
  }

  async filesInDateRange(fromValue: number, toValue: number): Promise<CommitteeFile[]> {
    const files = await this.all({criteria: {eventDate: {$gte: fromValue, $lte: toValue}}});
    return files.filter(file => !!file.eventDate);
  }

  async meetingFileByRoom(room: string): Promise<CommitteeFile | null> {
    const files = await this.all({criteria: {"meeting.room": room}});
    return files?.[0] || null;
  }

  async createOrUpdate(committeeFile: CommitteeFile): Promise<CommitteeFile> {
    if (committeeFile.id) {
      return this.update(committeeFile);
    } else {
      return this.create(committeeFile);
    }
  }

  async getById(id: string): Promise<CommitteeFile>  {
    this.logger.debug("getById:", id);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<CommitteeFileApiResponse>(`${this.BASE_URL}/${id}`), this.committeeFileNotifications);
    return apiResponse.response as CommitteeFile;
  }

  async update(committeeFile: CommitteeFile): Promise<CommitteeFile> {
    this.logger.debug("updating", committeeFile);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<CommitteeFileApiResponse>(this.BASE_URL + "/" + committeeFile.id, committeeFile), this.committeeFileNotifications);
    this.logger.debug("updated", committeeFile, "- received", apiResponse);
    return apiResponse.response as CommitteeFile;
  }

  async create(committeeFile: CommitteeFile): Promise<CommitteeFile> {
    this.logger.debug("creating", committeeFile);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<CommitteeFileApiResponse>(this.BASE_URL, committeeFile), this.committeeFileNotifications);
    this.logger.debug("created", committeeFile, "- received", apiResponse);
    return apiResponse.response as CommitteeFile;
  }

  async delete(committeeFile: CommitteeFile): Promise<CommitteeFile> {
    this.logger.debug("deleting", committeeFile);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<CommitteeFileApiResponse>(this.BASE_URL + "/" + committeeFile.id), this.committeeFileNotifications);
    this.logger.debug("deleted", committeeFile, "- received", apiResponse);
    return apiResponse.response as CommitteeFile;
  }

  async addToCommitteeDocumentsPage(file: CommitteeFile): Promise<string | null> {
    if (!file?.id) {
      this.logger.error("cannot add committee file without id", file);
      return null;
    } else {
      try {
        const year = this.dateUtils.asString(file.eventDate, undefined, UIDateFormat.YEAR);
        const yearPage = await this.pageForPath(`committee/${year}`);
        const target = yearPage || await this.latestYearDocumentsPage();
        if (!target) {
          this.logger.error("no committee documents page found for file", file.id, "year", year);
          return null;
        } else {
          return this.addFileIdToPage(target, file.id);
        }
      } catch (error) {
        this.logger.error("failed to add committee file to documents page", file.id, error);
        return null;
      }
    }
  }

  async addFileIdToPage(page: PageContent, fileId: string): Promise<string | null> {
    const row = (page.rows || []).find(candidate => candidate.type === PageContentType.COMMITTEE_DOCUMENTS);
    if (!row?.committeeDocuments) {
      this.logger.error("committee page has no documents row", page.path);
      return null;
    } else {
      const ids = row.committeeDocuments.fileIds || [];
      if (!ids.includes(fileId)) {
        row.committeeDocuments.fileIds = [...ids, fileId];
        await this.pageContentService.createOrUpdate(page);
        this.logger.info("added committee file", fileId, "to", page.path);
      }
      return page.path || null;
    }
  }

  async removeFromCommitteeDocumentsPage(file: CommitteeFile): Promise<void> {
    if (file?.id) {
      try {
        const year = this.dateUtils.asString(file.eventDate, undefined, UIDateFormat.YEAR);
        const target = await this.pageForPath(`committee/${year}`) || await this.latestYearDocumentsPage();
        const row = target && (target.rows || []).find(candidate => candidate.type === PageContentType.COMMITTEE_DOCUMENTS);
        if (row?.committeeDocuments?.fileIds?.includes(file.id)) {
          row.committeeDocuments.fileIds = row.committeeDocuments.fileIds.filter(id => id !== file.id);
          await this.pageContentService.createOrUpdate(target);
          this.logger.info("removed committee file", file.id, "from", target.path);
        }
      } catch (error) {
        this.logger.error("failed to remove committee file from documents page", file.id, error);
      }
    }
  }

  async documentsPagePathFor(file: CommitteeFile): Promise<string | null> {
    const year = this.dateUtils.asString(file.eventDate, undefined, UIDateFormat.YEAR);
    const yearPage = await this.pageForPath(`committee/${year}`);
    const target = yearPage || await this.latestYearDocumentsPage();
    return target?.path || null;
  }

  private async pageForPath(path: string): Promise<PageContent | null> {
    try {
      const page = await this.pageContentService.findByPath(path);
      return page?.id ? page : null;
    } catch (error) {
      this.logger.error("failed to load committee page", path, error);
      return null;
    }
  }

  private async latestYearDocumentsPage(): Promise<PageContent | null> {
    const pages = await this.pageContentService.all({
      criteria: {path: {$regex: "^committee/[^/]+$"}},
      sort: {path: -1}
    });
    return pages.find(page => (page.rows || []).some(row => row.type === PageContentType.COMMITTEE_DOCUMENTS)) || null;
  }

}
