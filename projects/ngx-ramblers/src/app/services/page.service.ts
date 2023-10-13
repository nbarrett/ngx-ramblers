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
import isEmpty from "lodash-es/isEmpty";
import first from "lodash-es/first";
import uniq from "lodash-es/uniq";

@Injectable({
  providedIn: "root"
})

export class PageService {
  private logger: Logger;
  public group: Organisation;
  private previouslySetTitles: string[] = [];

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
      this.setTitle(...this.previouslySetTitles);
    });
  }

  areaTitle(): string {
    return this.stringUtils.asTitle(this.urlService.area() || "home");
  }

  pageSubtitle(): string {
    if (this.urlService.pathContainsMongoId()) {
      return null;
    } else {
      return this.stringUtils.asTitle(this.stringUtils.asWords(this.urlService.lastPathSegment()));
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

  setTitle(...pageTitles: string[]) {
    if (this?.group?.longName) {
      this.previouslySetTitles = pageTitles;
      const areaTitle = this.areaTitle();
      const subTitle = this.pageSubtitle();
      const delimiter = ` — `;
      const rawData = pageTitles.length > 0 ? [this?.group?.shortName].concat(pageTitles) : [this?.group?.shortName, areaTitle, subTitle];
      const uniqueData = uniq(rawData.filter(item => item));
      const fullTitle = uniqueData.join(delimiter);
      this.logger.debug("group:", this?.group);
      this.logger.info("setTitle:pageTitles:", pageTitles, "rawData:", rawData, "uniqueData:", uniqueData, "fullTitle:", fullTitle);
      this.titleService.setTitle(fullTitle);
    } else {
      this.logger.info("setTitle:supplied pageTitles", pageTitles, "group not configured yet");
    }
  }

  areaExistsFor(url: string) {
    this.logger.info("areaExistsFor:url", url, "pages:", this.group.pages);
    const area = this.urlService.pageUrl(first(this.urlService.pathSegmentsForUrl(url)));
    return !!this.group.pages.find(page => {
      const pageUrl = this.urlService.pageUrl(page.href);
      this.logger.info("area:", area, "pageUrl:", pageUrl);
      return !isEmpty(page.href) && area === pageUrl;
    });
  }
}
