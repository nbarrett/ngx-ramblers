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
    const prepared = this.closeTableGaps(this.withImagesOnTheirOwnLines(this.relativeImageUrls(markdown)));
    const lines = prepared.split("\n");
    const isListLine = (line: string) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
    const isImageLine = (line: string) => /^!\[[^\]]*\]\([^)]+\)$/.test(line.trim()) || /^<img\b/i.test(line.trim());
    const isTableLine = (line: string) => /^\s*\|/.test(line);
    return lines.reduce<string[]>((built, line) => {
      const previous = built.length > 0 ? built[built.length - 1] : "";
      const previousHasText = previous.trim().length > 0;
      const lineHasText = line.trim().length > 0;
      const bothIndented = previous.startsWith("  ") && line.startsWith("  ");
      const tableRow = isTableLine(previous) && isTableLine(line);
      const betweenProse = previousHasText && lineHasText && !tableRow && !isListLine(previous) && !isListLine(line) && !isTableLine(previous) && !isTableLine(line) && !bothIndented;
      const leavesList = previousHasText && lineHasText && isListLine(previous) && !isListLine(line) && !isTableLine(line) && !line.startsWith("  ");
      const aroundImage = previousHasText && lineHasText && !tableRow && (isImageLine(previous) || isImageLine(line));
      const startsTable = previousHasText && isTableLine(line) && !isTableLine(previous);
      return (betweenProse || leavesList || aroundImage || startsTable) ? built.concat(["", line]) : built.concat([line]);
    }, []).join("\n").replace(/\n{3,}/g, "\n\n");
  }

  private closeTableGaps(markdown: string): string {
    const lines = (markdown || "").split("\n");
    const isTableLine = (line: string) => /^\s*\|/.test(line);
    return lines.filter((line, index) => {
      if (line.trim() !== "") {
        return true;
      } else {
        const previous = lines.slice(0, index).reverse().find(item => item.trim() !== "") || "";
        const next = lines.slice(index + 1).find(item => item.trim() !== "") || "";
        return !(isTableLine(previous) && isTableLine(next));
      }
    }).join("\n");
  }

  withImagesOnTheirOwnLines(markdown: string): string {
    const image = /!\[[^\]]*\]\([^)\n]+\)|<img\b[^>]*>/gi;
    return (markdown || "").split("\n").flatMap(line => {
      if (line.trim().startsWith("|")) {
        return [line];
      } else {
        const matches = [...line.matchAll(image)];
        if (matches.length === 0) {
          return [line];
        } else {
          const pieces: string[] = [];
          const cursor = {index: 0};
          matches.forEach(match => {
            const before = line.slice(cursor.index, match.index).trim();
            if (before) {
              pieces.push(before, "");
            }
            pieces.push(match[0]);
            cursor.index = (match.index || 0) + match[0].length;
            if (line.slice(cursor.index).trim()) {
              pieces.push("");
            }
          });
          const after = line.slice(cursor.index).trim();
          if (after) {
            pieces.push(after);
          }
          return pieces;
        }
      }
    }).join("\n").replace(/\n{3,}/g, "\n\n");
  }
}
