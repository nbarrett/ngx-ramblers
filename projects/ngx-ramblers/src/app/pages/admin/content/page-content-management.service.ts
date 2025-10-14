import { inject, Injectable } from "@angular/core";
import { PageContentService } from "../../../services/page-content.service";
import {
  BuiltInContentConfigs,
  BuiltInPageContentConfig,
  BuiltInPath,
  PageContentGroup,
  PageContent
} from "../../../models/content-text.model";
import { groupBy } from "es-toolkit/compat";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { first } from "es-toolkit/compat";


@Injectable({
  providedIn: "root",
})
export class PageContentManagementService {

  private pageContentService = inject(PageContentService);
  private logger: Logger = inject(LoggerFactory).createLogger("PageContentManagementService", NgxLoggerLevel.ERROR);

  async findDuplicates(): Promise<PageContentGroup[]> {
    const allContent: PageContent[] = await this.pageContentService.all();
    const filteredContent = allContent.filter(item => this.notABuiltInPath(item.path));
    const duplicates: PageContentGroup[] = Object.entries(groupBy(filteredContent, (item: PageContent) => first(item.path.split("#") || BuiltInPath.HOME)))
      .filter((entry: [key: string, values: PageContent[]]) => entry[1].length > 1)
      .map((entry: [path: string, contents: PageContent[]]) => ({path: entry[0], pageContents: entry[1]}));
    this.logger.info("allContent:", allContent, "filteredContent:", filteredContent, "duplicates:", duplicates);
    return duplicates;
  }

  notABuiltInPath(contentPath: string) {
    const parts = contentPath.split("#");
    const path = parts[0];
    const anchor = parts[1];
    const builtInContentConfig: BuiltInPageContentConfig = BuiltInContentConfigs[path || BuiltInPath.HOME];
    const notABuiltInPath = !builtInContentConfig || !builtInContentConfig.anchors.includes(anchor as any);
    this.logger.info("notABuiltInPath:contentPath:", contentPath, "path:", path, "anchor:", anchor, "builtInContentConfig", builtInContentConfig, "notABuiltInPath:", notABuiltInPath);
    return notABuiltInPath;
  }

  async deleteContent(contentPathId: string) {
    this.logger.info("deleteContent:", contentPathId);
    return await this.pageContentService.delete(contentPathId);
  }

  async changePath(contentPathId: string, changedPath: string): Promise<PageContent> {
    const pageContent = await this.pageContentService.findByPath(contentPathId);
    pageContent.path = changedPath;
    this.logger.info("changePath:contentPathId:", contentPathId, "changedPath:", changedPath, "pageContent:", pageContent);
    return await this.pageContentService.update(pageContent);
  }
}
