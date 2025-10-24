import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { HtmlPastePreview } from "../models/html-paste.model";
import { firstValueFrom } from "rxjs";
import { isString } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class ContentConversionService {

  private logger: Logger = inject(LoggerFactory).createLogger("ContentConversionService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private BASE_URL = "/api/migration";

  async htmlToMarkdown(html: string, baseUrl?: string): Promise<string> {
    try {
      this.logger.info("Converting HTML to markdown, length:", html.length, "baseUrl:", baseUrl);
      const response = await firstValueFrom(this.http.post<{ markdown: string }>(`${this.BASE_URL}/html-to-markdown`, { html, baseUrl }));
      if (!response || !isString(response.markdown)) {
        const error = new Error("Empty markdown response received from html-to-markdown endpoint");
        this.logger.error(error, "response:", response);
        throw error;
      }
      this.logger.info("Converted to markdown, length:", response.markdown.length);
      return response.markdown;
    } catch (error) {
      this.logger.error("Error converting HTML to markdown:", error);
      throw error;
    }
  }

  async htmlPastePreview(html: string, baseUrl?: string): Promise<HtmlPastePreview> {
    try {
      this.logger.info("Building HTML paste preview, length:", html.length, "baseUrl:", baseUrl);
      const response = await firstValueFrom(this.http.post<HtmlPastePreview>(`${this.BASE_URL}/html-paste-preview`, { html, baseUrl }));
      if (!response || !Array.isArray(response.rows)) {
        const error = new Error("Invalid html-paste-preview response received");
        this.logger.error(error, "response:", response);
        throw error;
      }
      this.logger.info("HTML paste preview generated with", response.rows.length, "rows");
      if (response.rows.length > 0) {
        this.logger.info("HTML paste preview first row:", response.rows[0]);
      }
      return response;
    } catch (error) {
      this.logger.error("Error building HTML paste preview:", error);
      throw error;
    }
  }

  async markdownPastePreview(markdown: string): Promise<HtmlPastePreview> {
    try {
      this.logger.info("Building markdown paste preview, length:", markdown.length);
      const response = await firstValueFrom(this.http.post<HtmlPastePreview>(`${this.BASE_URL}/markdown-paste-preview`, { markdown }));
      if (!response || !Array.isArray(response.rows)) {
        const error = new Error("Invalid markdown-paste-preview response received");
        this.logger.error(error, "response:", response);
        throw error;
      }
      this.logger.info("Markdown paste preview generated with", response.rows.length, "rows");
      if (response.rows.length > 0) {
        this.logger.info("Markdown paste preview first row:", response.rows[0]);
      }
      return response;
    } catch (error) {
      this.logger.error("Error building markdown paste preview:", error);
      throw error;
    }
  }

  async htmlFromUrl(url: string): Promise<{ html: string; baseUrl?: string }> {
    try {
      this.logger.info("Fetching HTML from URL:", url);
      const response = await firstValueFrom(this.http.post<{ html: string; baseUrl?: string }>(`${this.BASE_URL}/html-from-url`, { url }));
      if (!response || !isString(response.html)) {
        const error = new Error("Invalid html-from-url response received");
        this.logger.error(error, "response:", response);
        throw error;
      }
      return response;
    } catch (error) {
      this.logger.error("Error fetching HTML from URL:", error);
      throw error;
    }
  }
}
