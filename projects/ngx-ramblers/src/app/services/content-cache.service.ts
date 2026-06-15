import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent } from "../models/content-text.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { SiteEditService } from "../site-edit/site-edit.service";

@Injectable({
  providedIn: "root"
})
export class ContentCacheService {
  private logger: Logger = inject(LoggerFactory).createLogger("ContentCacheService", NgxLoggerLevel.ERROR);
  private siteEdit = inject(SiteEditService);
  private pages = new Map<string, PageContent>();
  private indexes = new Map<string, PageContent>();

  private cacheable(): boolean {
    return !this.siteEdit.active();
  }

  getPage(path: string): PageContent | undefined {
    return this.cacheable() ? this.pages.get(path) : undefined;
  }

  setPage(path: string, pageContent: PageContent): void {
    if (this.cacheable() && pageContent) {
      this.pages.set(path, pageContent);
    }
  }

  getIndex(key: string): PageContent | undefined {
    return this.cacheable() ? this.indexes.get(key) : undefined;
  }

  setIndex(key: string, pageContent: PageContent): void {
    if (this.cacheable() && pageContent) {
      this.indexes.set(key, pageContent);
    }
  }

  clear(): void {
    this.logger.info("clearing", this.pages.size, "cached pages and", this.indexes.size, "cached indexes");
    this.pages.clear();
    this.indexes.clear();
  }
}
