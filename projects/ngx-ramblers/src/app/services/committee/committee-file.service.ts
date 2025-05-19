import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { CommitteeFile, CommitteeFileApiResponse } from "../../models/committee.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class CommitteeFileService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeFileService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
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

}
