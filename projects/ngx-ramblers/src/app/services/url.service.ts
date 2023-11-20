import { DOCUMENT, Location } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { ActivatedRoute, Params, QueryParamsHandling, Router } from "@angular/router";
import first from "lodash-es/first";
import last from "lodash-es/last";
import tail from "lodash-es/tail";
import { NgxLoggerLevel } from "ngx-logger";
import {
  BASE64_PREFIX_JPEG,
  BASE64_PREFIX_PNG,
  ContentMetadata,
  ContentMetadataItem,
  S3_BASE_URL
} from "../models/content-metadata.model";
import { AWSLinkConfig, LinkConfig } from "../models/link.model";
import { SiteEditService } from "../site-edit/site-edit.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { isMongoId } from "./mongo-utils";
import isEmpty from "lodash-es/isEmpty";
import { isNumericRamblersId } from "./path-matchers";
import { StringUtilsService } from "./string-utils.service";
import { RootFolder } from "../models/system.model";

@Injectable({
  providedIn: "root"
})

export class UrlService {
  private logger: Logger;

  constructor(@Inject(DOCUMENT) private document: Document,
              private router: Router,
              private stringUtils: StringUtilsService,
              private location: Location,
              private siteEdit: SiteEditService,
              private loggerFactory: LoggerFactory,
              private route: ActivatedRoute) {
    this.logger = loggerFactory.createLogger(UrlService, NgxLoggerLevel.OFF);
  }

  pathContains(path: string): boolean {
    return this.location.path().includes(path);
  }

  navigateTo(pathSegments: string[], params?: Params, queryParamsHandling?: QueryParamsHandling): Promise<boolean> {
    if (this.siteEdit.active()) {
      return Promise.resolve(false);
    } else {
      return this.navigateUnconditionallyTo(pathSegments, params, queryParamsHandling);
    }
  }

  navigateUnconditionallyTo(pathSegments: string[], params?: Params, queryParamsHandling?: QueryParamsHandling): Promise<boolean> {
    const url = `${this.pageUrl(pathSegments.filter(item => item).join("/"))}`;
    this.logger.info("navigating to pathSegments:", pathSegments, "->", url, "params:", params, "queryParamsHandling:", queryParamsHandling);
    return this.router.navigate([url], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: queryParamsHandling || "merge"
    }).then((activated: boolean) => {
      this.logger.info("activated:", activated, "area is now:", this.area());
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

  urlPath(optionalUrl?: string): string {
    return decodeURIComponent(new URL(optionalUrl || this.absoluteUrl()).pathname.substring(1));
  }

  area(): string {
    return this.firstPathSegment();
  }

  firstPathSegment(): string {
    return first(this.pathSegments());
  }

  pathSegmentsForUrl(url: string): string[] {
    return url?.split("/")?.filter(item => !isEmpty(item)) || [];
  }

  pathMinusAnchorForUrl(url: string): string {
    return first(url?.split("#"));
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

  pathContainsWalkId(): boolean {
    return this.pathContainsMongoId() || this.pathContainsNumericRamblersId();
  }

  pathContainsNumericRamblersId(): boolean {
    return isNumericRamblersId(this.lastPathSegment());
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
      this.logger.debug("routerLinkUrl:url:", url, "not returning routerLinkUrl as url not present");
      return null;
    } else {
      const routerLinkUrl = this.isRemoteUrl(url) ? null : "/" + url;
      this.logger.debug("routerLinkUrl:url:", url, "routerLinkUrl:", routerLinkUrl);
      return routerLinkUrl;
    }
  }

  public isRemoteUrl(url: string): boolean {
    return url?.startsWith("http");
  }

  eventUrl(slide: ContentMetadataItem) {
    return this.linkUrl({
      area: slide.dateSource,
      id: slide.eventId
    });
  }

  imageSourceFor(item: ContentMetadataItem, contentMetadata: ContentMetadata): string {
    return this.imageSource(this.qualifiedFileNameWithRoot(contentMetadata?.rootFolder, contentMetadata?.name, item));
  }

  qualifiedFileNameWithRoot(rootFolder: RootFolder, contentMetaDataName: string, item: ContentMetadataItem): string {
    return item.base64Content ? item.base64Content : (item.image && !this.isRemoteUrl(item.image)) ? `${rootFolder}/${contentMetaDataName}/${item.image}` : null;
  }

  imageSource(url: string, absolute?: boolean): string {
    if (this.isRemoteUrl(url)) {
      this.logger.debug("imageSourceUrl:isRemoteUrl:returning", url);
      return url;
    } else if (this.isBase64Image(url)) {
      this.logger.debug("imageSourceUrl:isBase64Image:returning", url);
      return url;
    } else {
      const imageSource = absolute ? this.absolutePathForAWSFileName(url) : this.resourceRelativePathForAWSFileName(url);
      this.logger.debug("imageSource:url", url, "absolute:", absolute, "returning", imageSource);
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
    return this.pathSegmentsForUrl(this.router.url).includes(parameter);
  }

  pageUrl(page?: string): string {
    const pageOrEmpty = (page ? page : "");
    return pageOrEmpty.startsWith("/") ? pageOrEmpty : "/" + pageOrEmpty;
  }

  noArea(): boolean {
    return this.areaUrl() === "";
  }

  areaUrl(): string {
    return tail(this.pathSegmentsForUrl(new URL(this.absoluteUrl()).pathname.substring(1))).join("/");
  }

  isBase64Image(url: string): boolean {
    return url?.startsWith(BASE64_PREFIX_JPEG) || url?.startsWith(BASE64_PREFIX_PNG);
  }

  reformatHref(url: string): string {
    if (!url || (url.startsWith("http") || url.startsWith("www") || url.includes("://"))) {
      return url;
    } else {
      const reformatted: string = url.split("/").map(item => this.stringUtils.kebabCase(item)).join("/");
      this.logger.info("received", url, "reformatted to:", reformatted);
      return reformatted;
    }
  }

}
