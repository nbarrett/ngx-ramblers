import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { FragmentWithLabel, PageContent, PageContentRow } from "../models/content-text.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { PageContentService } from "./page-content.service";
import { UrlService } from "./url.service";
import { PageContentActionsService } from "./page-content-actions.service";

@Injectable({
  providedIn: "root"
})
export class FragmentService {
  private logger: Logger = inject(LoggerFactory).createLogger("FragmentService", NgxLoggerLevel.ERROR);
  private pageContentService = inject(PageContentService);
  private urlService = inject(UrlService);
  private actions = inject(PageContentActionsService);
  private fragmentsById: Map<string, PageContent> = new Map();
  private fragmentsByPath: Map<string, PageContent> = new Map();
  private failed: Set<string> = new Set();
  private fragmentLabelCache: Map<string, FragmentWithLabel> = new Map();

  normalise(path: string): string {
    return this.urlService.reformatLocalHref(path);
  }

  async ensureLoadedById(pageContentId: string): Promise<void> {
    if (!pageContentId) { return; }
    if (this.fragmentsById.has(pageContentId)) { return; }
    try {
      this.failed.delete(pageContentId);
      const content = await this.pageContentService.findById(pageContentId);
      if (!content) {
        this.logger.error("Fragment not found by ID", pageContentId);
        this.failed.add(pageContentId);
        return;
      }
      this.fragmentsById.set(pageContentId, content);
      if (content.path) {
        this.fragmentsByPath.set(this.normalise(content.path), content);
      }
    } catch (e) {
      this.logger.error("Failed to load fragment by ID", pageContentId, e);
      this.failed.add(pageContentId);
    }
  }

  async ensureLoaded(path: string): Promise<void> {
    const normalised = this.normalise(path);
    if (!normalised) { return; }
    if (this.fragmentsByPath.has(normalised)) { return; }
    try {
      this.failed.delete(normalised);
      const content = await this.pageContentService.findByPath(normalised);
      if (!content) {
        this.logger.error("Fragment not found for path", normalised);
        this.failed.add(normalised);
        return;
      }
      this.fragmentsByPath.set(normalised, content);
      if (content.id) {
        this.fragmentsById.set(content.id, content);
      }
    } catch (e) {
      this.logger.error("Failed to load fragment", normalised, e);
      this.failed.add(normalised);
    }
  }

  contentById(pageContentId: string): PageContent {
    return this.fragmentsById.get(pageContentId);
  }

  content(path: string): PageContent {
    return this.fragmentsByPath.get(this.normalise(path));
  }

  hasById(pageContentId: string): boolean {
    return this.fragmentsById.has(pageContentId);
  }

  has(path: string): boolean {
    return this.fragmentsByPath.has(this.normalise(path));
  }

  failedToLoad(pathOrId: string): boolean {
    return this.failed.has(pathOrId) || this.failed.has(this.normalise(pathOrId));
  }

  get fragmentLinks(): string[] {
    return (this.pageContentService.siteLinks || []).filter(path => (path || "").startsWith("fragments/"));
  }

  get fragments(): PageContent[] {
    return Array.from(this.fragmentsById.values());
  }

  fragmentWithLabelForId(pageContentId: string): FragmentWithLabel | null {
    if (!pageContentId) { return null; }
    if (this.fragmentLabelCache.has(pageContentId)) {
      return this.fragmentLabelCache.get(pageContentId);
    }
    const fragment = this.fragments.find(f => f.id === pageContentId);
    if (!fragment) { return null; }
    const withLabel: FragmentWithLabel = {
      pageContentId: fragment.id,
      ngSelectAttributes: {label: fragment.path}
    };
    this.fragmentLabelCache.set(pageContentId, withLabel);
    return withLabel;
  }

  async loadFragmentsRecursivelyFromRows(rows: PageContentRow[]): Promise<void> {
    if (rows) {
      for (const row of rows) {
        await this.loadTopLevelFragmentRows(row);
        await this.loadNestedFragmentRowsWithinTextRowColumns(row);
      }
    }
  }

  private async loadNestedFragmentRowsWithinTextRowColumns(row: PageContentRow) {
    if (this.actions.isTextRow(row) && row.columns) {
      for (const column of row.columns) {
        if (column.rows) {
          await this.loadFragmentsRecursivelyFromRows(column.rows);
        }
      }
    }
  }

  private async loadTopLevelFragmentRows(row: PageContentRow) {
    if (this.actions.isSharedFragment(row) && row?.fragment?.pageContentId) {
      await this.ensureLoadedById(row.fragment.pageContentId);
    }
  }
}
