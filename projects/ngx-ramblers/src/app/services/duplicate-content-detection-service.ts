import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import {
  ContentTextUsage,
  ContentTextUsageMap,
  DuplicateUsageMessage,
  HasPageContentRows,
  PageContent,
  PageContentColumn
} from "../models/content-text.model";
import { MarkdownEditorComponent } from "../markdown-editor/markdown-editor.component";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { BroadcastService } from "./broadcast-service";
import { StringUtilsService } from "./string-utils.service";
import { PageContentService } from "./page-content.service";

@Injectable({
  providedIn: "root"
})

export class DuplicateContentDetectionService {

  private logger: Logger = inject(LoggerFactory).createLogger("DuplicateContentDetectionService", NgxLoggerLevel.ERROR);
  private stringUtils: StringUtilsService = inject(StringUtilsService);
  private broadcastService = inject<BroadcastService<MarkdownEditorComponent>>(BroadcastService);
  private pageContentService = inject(PageContentService);
  private usageMap: ContentTextUsageMap = new Map();
  private activeMarkdownComponents: Set<MarkdownEditorComponent> = new Set();
  private detectionStarted = false;

  constructor() {
    this.broadcastService.on(NamedEventType.MARKDOWN_EDITOR_CREATED, (namedEvent: NamedEvent<MarkdownEditorComponent>) => {
      this.activeMarkdownComponents.add(namedEvent.data);
      this.logger.info("added:", namedEvent.data, "to:", this.stringUtils.pluraliseWithCount(this.activeMarkdownComponents.size, "active markdown component"));
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_EDITOR_DESTROYED, (namedEvent: NamedEvent<MarkdownEditorComponent>) => {
      this.activeMarkdownComponents.delete(namedEvent.data);
      this.logger.info("removed:", namedEvent.data, "from:", this.stringUtils.pluraliseWithCount(this.activeMarkdownComponents.size, "active markdown component"));
    });
  }


  async initialiseForAll(): Promise<void> {
    if (!this.detectionStarted) {
      this.detectionStarted = true;
      this.logger.info("initialiseForAll:starting detection");
      this.usageMap = new Map();
      const pages: PageContent[] = await this.pageContentService.all();
      pages.forEach(pageContent => this.applyPageContent(pageContent, this.usageMap));
      this.detectionStarted = false;
      this.logger.info("initialiseForAll:completed detection");
    } else {
      this.logger.info("initialiseForAll:detection already started");
    }
  }

  contentTextUsageMapForPageContent(pageContent: PageContent): ContentTextUsageMap {
    return this.applyPageContent(pageContent, new Map());
  }

  private applyPageContent(pageContent: PageContent, usageMap: ContentTextUsageMap): ContentTextUsageMap {
    return this.processRows(pageContent, pageContent.path, usageMap);
  }

  private processRows(pageContent: HasPageContentRows, contentPath: string, usageMap: ContentTextUsageMap) {
    pageContent.rows.forEach((row, rowIndex) => {
      row.columns.forEach((column: PageContentColumn, columnIndex) => {
        if (column.contentTextId) {
          if (!usageMap.has(column.contentTextId)) {
            usageMap.set(column.contentTextId, []);
          }
          const usage: ContentTextUsage = {
            contentPath,
            row: rowIndex + 1,
            column: columnIndex + 1,
            editorInstance: null
          };
          usageMap.get(column.contentTextId).push(usage);
        } else if (column.rows) {
          this.processRows(column, contentPath, usageMap);
        }
      });
    });
    this.logger.info("initialiseFor pageContent:", pageContent, "usageMap:", usageMap);
    return usageMap;
  }

  duplicateUsages(): ContentTextUsageMap {
    return new Map(Array.from(this.usageMap.entries()).filter(([_, usages]) => usages.length > 1));
  }

  usageMessages(): DuplicateUsageMessage[] {
    return Array.from(this.duplicateUsages().entries()).map(([id, usages]) => ({
      id,
      message: usages.map((usage) => `Row ${usage.row}, Column ${usage.column}`).join(", "),
    }));
  }

  isDuplicate(id: string) {
    const duplicates = this.duplicateUsages().get(id);
    this.logger.debug("isDuplicate:id:", id, "duplicates:", duplicates);
    return !!duplicates;
  }

  contentTextUsages(id: string): ContentTextUsage[] {
    const duplicates = this.duplicateUsages().get(id);
    this.logger.debug("isDuplicate:id:", id, "duplicates:", duplicates);
    return duplicates;
  }
}
