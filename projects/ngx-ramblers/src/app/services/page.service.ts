import { Location } from "@angular/common";
import { Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";
import last from "lodash-es/last";
import { NgxLoggerLevel } from "ngx-logger";
import { Link } from "../models/page.model";
import { Organisation } from "../models/system.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";
import { SystemConfigService } from "./system/system-config.service";
import { UrlService } from "./url.service";

@Injectable({
  providedIn: "root"
})

export class PageService {
  private logger: Logger;
  public group: Organisation;
  private previouslySetTitle: string;

  constructor(private stringUtils: StringUtilsService,
              private titleService: Title,
              private systemConfigService: SystemConfigService,
              private location: Location,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("PageService", NgxLoggerLevel.OFF);
    this.logger.info("subscribing to systemConfigService events");
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.setTitle(this.previouslySetTitle);
    });
  }

  areaTitle(): string {
    return this.stringUtils.asTitle(this.urlService.area() || "home");
  }

  pageSubtitle(): string {
    if (this.urlService.pathContainsMongoId()) {
      return null;
    } else {
      return this.stringUtils.asTitle(this.urlService.lastPathSegment());
    }
  }

  contentDescription(anchor?: string): string {
    return this.stringUtils.replaceAll("/", " ", this.contentPath(anchor)).toString().toLowerCase();
  }

  contentPath(anchor?: string): string {
    const anchorSuffixWithSuffix = anchor ? "#" + anchor : "";
    const path = this.pathSegments().join("/");
    const contentPath = `${path}${anchorSuffixWithSuffix}`;
    this.logger.debug("contentPath:anchor:", anchor, "path:", path, "contentPath:", contentPath);
    return contentPath;
  }

  pathSegments(): string[] {
    return this.urlService.pathSegments();
  }

  public relativePages(): Link[] {
    const pathSegments = this.urlService.pathSegments();
    this.logger.debug("pathSegments:", pathSegments);
    const relativePages: Link[] = pathSegments
      ?.filter(item => item !== last(pathSegments))
      ?.map((path, index) => ({title: this.stringUtils.asTitle(path), href: this.pathSegmentsUpTo(pathSegments, index)}));
    this.logger.debug("relativePages:", relativePages);
    return this.group?.pages ? [this.group.pages[0]].concat(relativePages) : relativePages;
  }

  private pathSegmentsUpTo(pathSegments: string[], upToIndex: number): string {
    return `${pathSegments.filter((item, index) => index <= upToIndex).join("/")}`;
  }

  nested() {
    return this.urlService.pathSegments().length > 1;
  }

  setTitle(pageTitle?: string) {
    this.previouslySetTitle = pageTitle;
    const areaTitle = this.areaTitle();
    const subTitle = pageTitle || this.pageSubtitle();
    this.logger.info("areaTitle:", areaTitle, "subTitle:", subTitle);
    const fullTitle = areaTitle && subTitle && (areaTitle !== subTitle) ? `${this?.group?.shortName} — ${areaTitle} — ${subTitle}` : `${this?.group?.shortName} — ${areaTitle}`;
    this.titleService.setTitle(fullTitle);
  }

}
