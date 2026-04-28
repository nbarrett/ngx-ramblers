import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { values } from "es-toolkit/compat";
import { LoggerFactory } from "../../services/logger-factory.service";
import { ContentText, PageContent, PageContentPath, PageContentType } from "../../models/content-text.model";
import { ContentTextService } from "../../services/content-text.service";
import { LegacyStoredValue } from "../../models/ui-actions";
import { DEFAULT_CONTENT_ENTRIES } from "./default-content";

@Injectable({
  providedIn: "root"
})
export class DataPopulationService {

  private contentTextService: ContentTextService = inject(ContentTextService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("DataPopulationService", NgxLoggerLevel.OFF);
  private defaultContentMap: Map<string, string> = new Map();
  private defaultContentByName: Map<string, string> = new Map();

  constructor() {
    this.buildDefaultContentMap();
  }

  private buildDefaultContentMap(): void {
    const defaultContent = this.defaultContentArray();
    defaultContent.forEach(item => {
      if (item.name) {
        this.defaultContentByName.set(item.name, item.text);
      }
      const key = this.buildKey(item.category, item.name);
      if (key) {
        this.defaultContentMap.set(key, item.text);
      }
    });
  }

  public hasDefaultContent(category: string, name: string): boolean {
    return !!this.resolveDefaultContent(category, name);
  }

  public defaultContent(category: string, name: string): string | undefined {
    return this.resolveDefaultContent(category, name);
  }

  private resolveDefaultContent(category: string, name: string): string | undefined {
    const key = this.buildKey(category, name);
    if (key && this.defaultContentMap.has(key)) {
      return this.defaultContentMap.get(key);
    }
    if (name && this.defaultContentByName.has(name)) {
      return this.defaultContentByName.get(name);
    }
    return undefined;
  }

  private buildKey(category?: string, name?: string): string | null {
    if (!category || !name) {
      return null;
    }
    return `${category}:${name}`;
  }

  public fragmentPaths(): string[] {
    try {
      return Array.from(this.defaultContentMap.keys())
        .filter(() => false);
    } catch {
      return [];
    }
  }

  public clearLegacyLocalStorage(): void {
    try {
      const keys = values(LegacyStoredValue);
      keys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          this.logger.debug("Removed legacy localStorage key:", key);
        }
      });
    } catch (e) {
      this.logger.warn("clearLegacyLocalStorage: unable to access localStorage", e);
    }
  }

  private defaultContentArray(): ContentText[] {
    return DEFAULT_CONTENT_ENTRIES;
  }


  public async generateDefaultContentTextItems() {
    this.logger.info("generating defaultContentTextItems");
    const defaultContent: ContentText[] = this.defaultContentArray();
    const defaultContentTextItems = await Promise.all(defaultContent.map(async (contentText: ContentText) => await this.contentTextService.findOrCreateByNameAndCategory(contentText.name, contentText.category, contentText.text)));
    this.logger.info("generated defaultContentTextItems", defaultContentTextItems);
    return defaultContentTextItems;
  }

  defaultPageContentForAdminActionButtons(): PageContent {
    const defaultPageContent: PageContent = {
      path: PageContentPath.ADMIN_ACTION_BUTTONS, rows: [
        {
          maxColumns: 3,
          showSwiper: false,
          type: PageContentType.ACTION_BUTTONS,
          columns: []
        }]
    };
    this.logger.info("generated defaultPageContentForAdminActionButtons - menu items populated by database migration", defaultPageContent);
    return defaultPageContent;
  }
}
