import { DOCUMENT, Location } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { ActivatedRoute, Params, QueryParamsHandling, Router } from "@angular/router";
import first from "lodash-es/first";
import last from "lodash-es/last";
import tail from "lodash-es/tail";
import { NgxLoggerLevel } from "ngx-logger";
import {
  BASE64_PREFIX_HEIC,
  BASE64_PREFIX_JPEG,
  BASE64_PREFIX_PNG,
  ContentMetadata,
  ContentMetadataItem,
  HasEventId,
  S3_BASE_URL
} from "../models/content-metadata.model";
import { AWSLinkConfig, LinkConfig, LinkTextConfig } from "../models/link.model";
import { SiteEditService } from "../site-edit/site-edit.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { isMongoId } from "./mongo-utils";
import isEmpty from "lodash-es/isEmpty";
import { isNumericRamblersId } from "./path-matchers";
import { StringUtilsService } from "./string-utils.service";
import { Organisation, RootFolder } from "../models/system.model";
import { SystemConfigService } from "./system/system-config.service";
import { DateUtilsService } from "./date-utils.service";
import { FALLBACK_MEDIA } from "../models/walk.model";

@Injectable({
  providedIn: "root"
})

export class UrlService {

  private logger: Logger = inject(LoggerFactory).createLogger("UrlService", NgxLoggerLevel.ERROR);
  private document = inject<Document>(DOCUMENT);
  private router = inject(Router);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private location = inject(Location);
  private siteEdit = inject(SiteEditService);
  private route = inject(ActivatedRoute);
  private group: Organisation;
  private cacheBuster: number;

  constructor() {
    this.systemConfigService.events().subscribe(item => this.group = item.group);
    this.cacheBuster = this.dateUtils.nowAsValue();
  }

  public isMeetupUrl(externalUrl: string) {
    return externalUrl?.includes("meetup.com");
  }

  pathContains(path: string): boolean {
    return this.location.path().includes(path);
  }

  public pathOnlyFrom(path: string) {
    return first(path?.split("?"));
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
    const isLocal = this.isLocal(url);
    if (this.group?.href && !isLocal) {
      return this.group.href;
    } else {
      return `${url.protocol}//${url.host}`;
    }
  }

  private isLocal(url: URL) {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  }

  websocketHost(): string {
    const url = new URL(this.absoluteUrl());
    return url.protocol === "https:" ? url.host.split(":")[0] : url.host;
  }

  websocketProtocol() {
    const url = new URL(this.absoluteUrl());
    return url.protocol === "https:" ? "wss" : "ws";
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

  lastPathSegmentNumeric() {
    return !isNaN(+this.lastPathSegment())
  }

  pathSegments(): string[] {
    const pathSegments = this.router.parseUrl(this.router.url)?.root?.children?.primary?.segments?.map(item => item.path) || [];
    this.logger.debug("pathSegments:", pathSegments);
    return pathSegments;
  }

  segmentWithMongoId(): string {
    return this.pathSegments().find(segment => this.isMongoId(segment));
  }

  pathContainsMongoId(): boolean {
    return !!this.segmentWithMongoId();
  }

  looksLikeASlug(value: string) {
    return /[\s-]/.test(value);
  }

  pathContainsEventIdOrSlug(): boolean {
    return this.pathContainsMongoId() || this.pathContainsNumericRamblersId() || (this.pathSegments().length === 2 && this.looksLikeASlug(this.lastPathSegment()));
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

  linkText(linkTextConfig: LinkTextConfig) {
    return !linkTextConfig.text && linkTextConfig.name ? linkTextConfig.name : linkTextConfig.text || linkTextConfig.href;
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
      this.logger.off("routerLinkUrl:url:", url, "not returning routerLinkUrl as url not present");
      return null;
    } else {
      const routerLinkUrl = this.isRemoteUrl(url) ? null : "/" + url;
      this.logger.off("routerLinkUrl:url:", url, "routerLinkUrl:", routerLinkUrl);
      return routerLinkUrl;
    }
  }

  public isRemoteUrl(url: string): boolean {
    return url?.startsWith("http");
  }

  eventUrl(hasEventId: HasEventId) {
    const linkConfig = {
      area: hasEventId.dateSource,
      id: hasEventId.eventId
    };
    this.logger.info("eventUrl", hasEventId, "linkConfig:", linkConfig);
    return this.linkUrl(linkConfig);
  }

  imageSourceFor(item: ContentMetadataItem, contentMetadata: ContentMetadata): string {
    return this.imageSource(this.qualifiedFileNameWithRoot(contentMetadata?.rootFolder, contentMetadata?.name, item));
  }

  qualifiedFileNameWithRoot(rootFolder: RootFolder, contentMetaDataName: string, item: ContentMetadataItem): string {
    if (this.isRemoteUrl(item.image)) {
      this.logger.info("qualifiedFileNameWithRoot:isRemoteUrl:returning", item.image);
      return item.image;
    } else {
      const qualifiedFileNameWithRoot = item.base64Content ? item.base64Content : (item.image && !this.isRemoteUrl(item.image)) ? `${rootFolder}/${contentMetaDataName}/${item.image}` : null;
      this.logger.info("qualifiedFileNameWithRoot:", qualifiedFileNameWithRoot, "rootFolder:", rootFolder, "contentMetaDataName:", contentMetaDataName, "item:", item);
      return qualifiedFileNameWithRoot;
    }
  }

  imageSource(url: string, absolute?: boolean, cacheBuster?: boolean): string {
    if (this.isRemoteUrl(url)) {
      this.logger.info("imageSourceUrl:isRemoteUrl:returning", url);
      return url;
    } else if (FALLBACK_MEDIA.url === url) {
      this.logger.info("imageSourceUrl:FALLBACK_MEDIA:returning", url);
      return url;
    } else if (this.isBase64Image(url)) {
      this.logger.debug("imageSourceUrl:isBase64Image:returning", url);
      return url;
    } else {
      const imageSource = (absolute ? this.absolutePathForAWSFileName(url) : this.resourceRelativePathForAWSFileName(url)) + (cacheBuster ? `?${this.cacheBuster}` : "");
      this.logger.info("imageSource:url", url, "absolute:", absolute, "returning", imageSource);
      return imageSource;
    }
  }

  isUrlWithId(linkConfig: LinkConfig | AWSLinkConfig): linkConfig is LinkConfig {
    return (linkConfig as LinkConfig).id !== undefined;
  }

  absolutePathForAWSFileName(fileName: string): string {
    return `${this.baseUrl()}/${this.resourceRelativePathForAWSFileName(fileName)}`;
  }

  removeS3PrefixFrom(fileName: string): string {
    return fileName?.includes(S3_BASE_URL) ? fileName.replace(S3_BASE_URL, "") : fileName;
  }

  resourceRelativePathForAWSFileName(fileName: string): string {
    return fileName ? fileName.includes(S3_BASE_URL) ? fileName : `${S3_BASE_URL}/${fileName}` : null;
  }

  hasRouteParameter(parameter: string): boolean {
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
    return [BASE64_PREFIX_HEIC, BASE64_PREFIX_JPEG, BASE64_PREFIX_PNG].some(prefix => url?.startsWith(prefix));
  }

  reformatLocalHref(url: string): string {
    if (!url || (url.startsWith("http") || url.startsWith("www") || url.includes("://"))) {
      return url;
    } else {
      const reformatted: string = url.split("/").map(item => /[A-Z\s]/.test(item) ? this.stringUtils.kebabCase(item) : item).join("/");
      this.logger.off("received", url, "reformatted to:", reformatted);
      return reformatted;
    }
  }

  removeQueryParameter(param: string) {
    const queryParams = {...this.route.snapshot.queryParams};
    this.logger.info("removing query parameter:", param, "from:", queryParams);
    delete queryParams[param];
    this.logger.info("now navigating to:", queryParams);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: ""
    });
  }

  public redirectToNormalisedUrl(normalisedUrl: string): Promise<boolean>{
    if (normalisedUrl !== this.urlPath()) {
      const navigateToPath = this.pathMinusAnchorForUrl(normalisedUrl);
      this.logger.info("need to move to:", navigateToPath);
      return this.navigateUnconditionallyTo([navigateToPath]);
    } else {
      return Promise.resolve(true);
    }
  }

}
