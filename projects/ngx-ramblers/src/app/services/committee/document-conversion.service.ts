import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { DocumentConversionApiResponse, DocumentConversionResponse } from "../../models/committee.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class DocumentConversionService {
  private logger: Logger = inject(LoggerFactory).createLogger("DocumentConversionService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/document-conversion";
  private conversionNotifications = new Subject<DocumentConversionApiResponse>();

  async convertFile(file: File): Promise<DocumentConversionResponse> {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DocumentConversionApiResponse>(`${this.BASE_URL}/file`, formData), this.conversionNotifications);
    return apiResponse.response as DocumentConversionResponse;
  }

  async convertCommitteeFile(id: string): Promise<DocumentConversionResponse> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DocumentConversionApiResponse>(`${this.BASE_URL}/committee-file/${id}`, {}), this.conversionNotifications);
    return apiResponse.response as DocumentConversionResponse;
  }
}
