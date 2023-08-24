import { DOCUMENT, Location } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import first from "lodash-es/first";
import last from "lodash-es/last";
import tail from "lodash-es/tail";
import { NgxLoggerLevel } from "ngx-logger";
import { BASE64_PREFIX_JPEG, BASE64_PREFIX_PNG, S3_BASE_URL } from "../models/content-metadata.model";
import { AWSLinkConfig, LinkConfig } from "../models/link.model";
import { SiteEditService } from "../site-edit/site-edit.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { isMongoId } from "./mongo-utils";

@Injectable({
  providedIn: "root"
})

export class UrlService {
  private logger: Logger;

  constructor(@Inject(DOCUMENT) private document: Document,
              private router: Router,
              private location: Location,
              private siteEdit: SiteEditService,
              private loggerFactory: LoggerFactory,
              private route: ActivatedRoute) {
    this.logger = loggerFactory.createLogger(UrlService, NgxLoggerLevel.OFF);
  }

  pathContains(path: string): boolean {
    return this.location.path().includes(path);
  }

  navigateTo(...pathSegments: string[]): Promise<boolean> {
    if (this.siteEdit.active()) {
      return Promise.resolve(false);
    } else {
      return this.navigateUnconditionallyTo(...pathSegments);
    }
  }

  navigateUnconditionallyTo(...pathSegments: string[]): Promise<boolean> {
    const url = `${this.pageUrl(pathSegments.filter(item => item).join("/"))}`;
    this.logger.debug("navigating to pathSegments:", pathSegments, "->", url);
    return this.router.navigate([url], {relativeTo: this.route, queryParamsHandling: "merge"}).then((activated: boolean) => {
      this.logger.debug("activated:", activated, "area is now:", this.area());
      return activated;
    });
  }

  navigateToUrl(url: string, $event: MouseEvent) {
    if (!this.siteEdit.active()) {
      const controlOrMetaKey: boolean = $event.ctrlKey || $event.metaKey;
      this.logger.debug("navigateToUrl:", url, "controlOrMetaKey:", controlOrMetaKey, "$event:", $event);
      if (controlOrMetaKey) {
        window.open(url, "_blank");
      } else {
        this.document.location.href = url;
      }
    }
  }

  absoluteUrl(): string {
    this.logger.debug("absUrl: document.location.href", this.document.location.href);
    return this.document.location.href;
  }

  baseUrl(): string {
    const url = new URL(this.absoluteUrl());
    return `${url.protocol}//${url.host}`;
  }

  relativeUrl(optionalUrl?: string): string {
    return "/" + this.urlPath(optionalUrl);
  }

  urlPath(optionalUrl?: string) {
    return new URL(optionalUrl || this.absoluteUrl()).pathname.substring(1);
  }

  area(): string {
    return this.firstPathSegment();
  }

  firstPathSegment(): string {
    return first(this.pathSegments());
  }

  lastPathSegment() {
    return last(this.pathSegments());
  }

  pathSegments(): string[] {
    const pathSegments = this.router.parseUrl(this.router.url)?.root?.children?.primary?.segments?.map(item => item.path) || [];
    this.logger.debug("pathSegments:", pathSegments);
    return pathSegments;
  }

  pathContainsMongoId(): boolean {
    return this.isMongoId(this.lastPathSegment());
  }

  isMongoId(id: string): boolean {
    return isMongoId(id);
  }

  resourceUrl(area: string, subArea: string, id: string, relative?: boolean): string {
    return [relative ? null : this.baseUrl(), area, subArea, id].filter(item => !!item).join("/");
  }

  refresh(): void {
    location.reload();
  }

  linkUrl(linkConfig: LinkConfig | AWSLinkConfig): string {
    if (this.isUrlWithId(linkConfig)) {
      return this.resourceUrl(linkConfig.area, linkConfig.subArea, linkConfig.id, linkConfig.relative);
    } else {
      return this.absolutePathForAWSFileName(linkConfig.name);
    }
  }

  routerLinkUrl(url: string): string {
    if (!url) {
      this.logger.info("routerLinkUrl:url:", url, "not returning routerLinkUrl as url not present");
      return null;
    } else {
      const routerLinkUrl = this.isRemoteUrl(url) ? null : "/" + url;
      this.logger.info("routerLinkUrl:url:", url, "routerLinkUrl:", routerLinkUrl);
      return routerLinkUrl;
    }
  }

  public isRemoteUrl(url: string): boolean {
    return url?.startsWith("http");
  }

  imageSource(url: string, absolute?: boolean): string {
    if (this.isRemoteUrl(url)) {
      this.logger.info("imageSourceUrl:isRemoteUrl:returning", url);
      return url;
    } else if (this.isBase64Image(url)) {
      this.logger.info("imageSourceUrl:isBase64Image:returning", url);
      return url;
    } else {
      const imageSource = absolute ? this.absolutePathForAWSFileName(url) : this.resourceRelativePathForAWSFileName(url);
      this.logger.info("imageSource:url", url, "absolute:", absolute, "returning", imageSource);
      return imageSource;
    }
  }

  isUrlWithId(linkConfig: LinkConfig | AWSLinkConfig): linkConfig is LinkConfig {
    return (linkConfig as LinkConfig).id !== undefined;
  }

  absolutePathForAWSFileName(fileName): string {
    return `${this.baseUrl()}/${this.resourceRelativePathForAWSFileName(fileName)}`;
  }

  removeS3PrefixFrom(fileName): string {
    return fileName?.includes(S3_BASE_URL) ? fileName.substring(S3_BASE_URL) : fileName;
  }

  resourceRelativePathForAWSFileName(fileName: string): string {
    return fileName ? fileName.includes(S3_BASE_URL) ? fileName : `${S3_BASE_URL}/${fileName}` : null;
  }

  hasRouteParameter(parameter): boolean {
    return this.router.url.split("/").includes(parameter);
  }

  pageUrl(page?: string): string {
    const pageOrEmpty = (page ? page : "");
    return pageOrEmpty.startsWith("/") ? pageOrEmpty : "/" + pageOrEmpty;
  }

  noArea(): boolean {
    return this.areaUrl() === "";
  }

  areaUrl(): string {
    return tail(new URL(this.absoluteUrl()).pathname.substring(1).split("/")).join("/");
  }

  private isBase64Image(url: string): boolean {
    return url?.startsWith(BASE64_PREFIX_JPEG) || url?.startsWith(BASE64_PREFIX_PNG);
  }
}
