import { inject, Injectable } from "@angular/core";
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
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";

@Injectable({
  providedIn: "root"
})

export class PageService {

  private logger: Logger = inject(LoggerFactory).createLogger("PageService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private titleService = inject(Title);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  public group: Organisation;
  private previouslySetTitles: string[] = [];
  private socialLink: Link;
  private walkLink: Link;
  private subject = new ReplaySubject<Link>();

  constructor() {
    this.logger.info("subscribing to systemConfigService events");
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.socialLink = item.group.pages.find(item => item.title.toLowerCase().includes("social"));
      this.walkLink = item.group.pages.find(item => item.title.toLowerCase().includes("walks"));
      this.logger.info("social page found as:", this.socialLink, "walks page found as:", this.walkLink, "group:", this.group);
      this.subject.next(this.socialLink);
      this.subject.next(this.walkLink);
      this.setTitle(...this.previouslySetTitles);
    });
  }

  areaTitle(): string {
    return this.stringUtils.asTitle(this.urlService.area() || "home");
  }

  public socialPageEvents(): Observable<Link> {
    return this.subject.pipe(shareReplay());
  }

  public socialPage(): Link {
    return this.socialLink;
  }

  walksPage(): Link {
    return this.walkLink;
  }

  pageSubtitle(): string {
    if (this.urlService.pathContainsMongoId()) {
      return null;
    } else {
      const lastPathSegment = this.urlService.lastPathSegment();
      return this.subtitleFrom(lastPathSegment);
    }
  }

  public subtitleFrom(lastPathSegment: string) {
    return this.stringUtils.asTitle(this.stringUtils.asWords(lastPathSegment));
  }

  contentDescription(anchor?: string): string {
    return this.stringUtils.replaceAll("/", " ", this.contentPath(anchor)).toString().toLowerCase();
  }

  contentPath(anchor?: string): string {
    const anchorSuffixWithSuffix = this.anchorWithSuffix(anchor);
    const path = this.pathSegments().join("/");
    const contentPath = `${path}${anchorSuffixWithSuffix}`;
    const normalisedContentPath = this.urlService.reformatLocalHref(contentPath);
    this.logger.info("contentPath:anchor:", anchor, "pathSegments:", this.pathSegments(), "path:", path, "contentPath:", contentPath, "normalisedContentPath:", normalisedContentPath);
    return normalisedContentPath;
  }

  public anchorWithSuffix(anchor: string) {
    return anchor ? "#" + anchor : "";
  }

  pathSegments(): string[] {
    return this.urlService.pathSegments();
  }

  public relativePages(): Link[] {
    const pathSegments = this.urlService.pathSegments();
    return this.linksFromPathSegments(pathSegments, "View");
  }

  public linksFromPathSegments(pathSegments: string[], replaceMongoIdWith?: string, includeLast?: boolean): Link[] {
    this.logger.debug("pathSegments:", pathSegments);
    const relativePages: Link[] = pathSegments
      ?.filter(item => includeLast || item !== last(pathSegments))
      ?.map((path, index) => ({
        title: this.urlService.isMongoId(path) ? replaceMongoIdWith : this.stringUtils.asTitle(path),
        href: this.pathSegmentsUpTo(pathSegments, index)
      }));
    this.logger.debug("linksFromPathSegments:", relativePages);
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
      this.logger.info("setTitle:areaTitle:", areaTitle, "subTitle:", subTitle, "pageTitles:", pageTitles, "rawData:", rawData, "uniqueData:", uniqueData, "fullTitle:", fullTitle);
      this.titleService.setTitle(fullTitle);
    } else {
      this.logger.info("setTitle:supplied pageTitles", pageTitles, "group longName not configured yet");
    }
  }

  areaExistsFor(url: string): boolean {
    this.logger.info("areaExistsFor:url", url, "pages:", this.group?.pages, "this.group", this.group);
    const area = this.urlService.pageUrl(first(this.urlService.pathSegmentsForUrl(url)));
    return !this.group || !!this.group?.pages?.find(page => {
      const pageUrl = this.urlService.pageUrl(page.href);
      this.logger.info("area:", area, "pageUrl:", pageUrl);
      return !isEmpty(page.href) && area === pageUrl;
    });
  }
}
