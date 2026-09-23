import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { DocumentConversionApiResponse, DocumentConversionResponse } from "../../models/committee.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { separateEditingBlocks as splitEditingBlocks, withImagesOnTheirOwnLines as splitImagesOntoOwnLines } from "../../functions/markdown-editing-blocks";
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

  async convertClipboardHtml(html: string): Promise<DocumentConversionResponse> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DocumentConversionApiResponse>(`${this.BASE_URL}/clipboard-html`, {html}), this.conversionNotifications);
    return apiResponse.response as DocumentConversionResponse;
  }

  async convertCommitteeFile(id: string): Promise<DocumentConversionResponse> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DocumentConversionApiResponse>(`${this.BASE_URL}/committee-file/${id}`, {}), this.conversionNotifications);
    return apiResponse.response as DocumentConversionResponse;
  }

  relativeAwsImagePath(path: string): string {
    const stored = (path || "").match(/^(?:https?:\/\/[^/]+)?\/?(api\/aws\/s3\/\S+)$/i);
    return stored ? stored[1] : path;
  }

  relativeImageUrls(markdown: string): string {
    return (markdown || "")
      .replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (_match, before, path, after) => `${before}${this.relativeAwsImagePath(path)}${after}`)
      .replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi, (_match, before, path, after) => `${before}${this.relativeAwsImagePath(path)}${after}`);
  }

  separateEditingBlocks(markdown: string): string {
    return splitEditingBlocks(this.relativeImageUrls(markdown));
  }

  withImagesOnTheirOwnLines(markdown: string): string {
    return splitImagesOntoOwnLines(markdown);
  }
}
