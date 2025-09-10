import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { last } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../models/api-request.model";
import {
  AllAndSelectedContentMetaData,
  ContentMetadata,
  ContentMetadataApiResponse,
  ContentMetadataApiResponses,
  ContentMetadataItem,
  DuplicateImages,
  ImageFilterType,
  ImageTag,
  S3_BASE_URL,
  S3_METADATA_URL,
  S3Metadata,
  S3MetadataApiResponse
} from "../models/content-metadata.model";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";
import { sortBy } from "../functions/arrays";
import { CommonDataService } from "./common-data-service";
import { DateUtilsService } from "./date-utils.service";
import { ImageDuplicatesService } from "./image-duplicates-service";
import { ImageTagDataService } from "./image-tag-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { RootFolder } from "../models/system.model";
import { StringUtilsService } from "./string-utils.service";
import { first } from "es-toolkit/compat";
import { MemberLoginService } from "./member/member-login.service";
import { take } from "es-toolkit/compat";
import { UrlService } from "./url.service";

@Injectable({
  providedIn: "root"
})

export class ContentMetadataService {

  private logger: Logger = inject(LoggerFactory).createLogger("ContentMetadataService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  memberLoginService = inject(MemberLoginService);
  urlService = inject(UrlService);
  private searchFilterPipe = inject(SearchFilterPipe);
  imageTagDataService = inject(ImageTagDataService);
  private imageDuplicatesService = inject(ImageDuplicatesService);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/database/content-metadata";
  private contentMetadataSubject = new Subject<ContentMetadataApiResponse>();
  private contentMetadataSubjects = new Subject<ContentMetadataApiResponses>();
  private s3MetadataSubject = new Subject<S3MetadataApiResponse>();
  public carousels: string[];

  contentMetadataNotifications(): Observable<ContentMetadataApiResponses> {
    return this.contentMetadataSubjects.asObservable();
  }

  s3Notifications(): Observable<S3MetadataApiResponse> {
    return this.s3MetadataSubject.asObservable();
  }

  baseUrl(rootFolder: string) {
    return `${S3_BASE_URL}/${rootFolder}`;
  }

  optionallyMigrate(contentMetaData: ContentMetadata, rootFolder: RootFolder, name: string): ContentMetadata {
    return contentMetaData?.rootFolder ?
      {
        ...contentMetaData,
        files: this.transformFileNames(contentMetaData),
      } :
      {
        ...contentMetaData,
        files: this.transformFileNames(contentMetaData),
        rootFolder,
        name,
      };
  }

  private transformFileNames(contentMetadataApiResponse: ContentMetadata) {
    return contentMetadataApiResponse?.files
      .filter(item => item?.image)
      .map(item => ({
        ...item, image: this.truncatePathFromName(item.image)
      }));
  }

  public truncatePathFromName(imagePath: string) {
    if (this.urlService.isRemoteUrl(imagePath)) {
      this.logger.info("imagePath:", imagePath, "is remote - not truncating");
      return imagePath;
    } else {
      const fileName = last(imagePath?.split("/"));
      if (fileName !== imagePath) {
        this.logger.info("truncated fileName:item:", imagePath, "to:", fileName);
        return fileName;
      } else {
        this.logger.info("fileName already truncated:", imagePath);
        return imagePath;
      }
    }
  }

  async delete(contentMetadata: ContentMetadata): Promise<any> {
    const apiResponse = await this.http.delete<{
      response: ContentMetadata
    }>(this.BASE_URL + "/" + contentMetadata.id).toPromise();
    this.logger.debug("delete", contentMetadata, "- received", apiResponse);
    return Promise.resolve(apiResponse);
  }

  async create(contentMetaData: ContentMetadata): Promise<ContentMetadata> {
    this.logger.debug("creating", contentMetaData);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ContentMetadataApiResponse>(this.BASE_URL, contentMetaData), this.contentMetadataSubject);
    this.logger.debug("created", contentMetaData, "- received", apiResponse);
    return apiResponse.response;
  }

  async update(contentMetaData: ContentMetadata): Promise<ContentMetadata> {
    this.logger.debug("updating", contentMetaData);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<ContentMetadataApiResponse>(this.BASE_URL + "/" + contentMetaData.id, contentMetaData), this.contentMetadataSubject);
    this.logger.debug("updated", contentMetaData, "- received", apiResponse);
    return apiResponse.response;
  }

  async createOrUpdate(contentMetaData: ContentMetadata): Promise<ContentMetadata> {
    if (contentMetaData.id) {
      return this.update(contentMetaData);
    } else {
      return this.create(contentMetaData);
    }
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<ContentMetadata[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ContentMetadataApiResponses>(`${this.BASE_URL}/all`, {params}), this.contentMetadataSubjects);
    return apiResponse.response.map(item => this.optionallyMigrate(item, item.rootFolder || RootFolder.carousels, item.name)) as ContentMetadata[];
  }

  async items(rootFolder: RootFolder, name: string): Promise<ContentMetadata> {
    const options: DataQueryOptions = {criteria: {$or: [{name}, {contentMetaDataType: name}]}};
    const params = this.commonDataService.toHttpParams(options);
    this.logger.debug("items:criteria:params", params.toString());
    const apiResponse: ContentMetadataApiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ContentMetadataApiResponse>(this.BASE_URL, {params}), this.contentMetadataSubject);
    const response = this.optionallyMigrate(apiResponse.response, rootFolder || RootFolder.carousels, name);
    this.logger.info("items:transformed apiResponse", response);
    return response;
  }

  async listMetaData(prefix: string): Promise<S3Metadata[]> {
    const url = `${S3_METADATA_URL}?prefix=${prefix}`;
    this.logger.debug("listMetaData:prefix", prefix, "url:", url);
    const apiResponse: S3MetadataApiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<S3MetadataApiResponse>(url), this.s3MetadataSubject);
    this.logger.debug("listMetaData:prefix", prefix, "returning S3MetadataApiResponse:", apiResponse);
    return apiResponse.response;
  }

  filterAndSort(showDuplicates: boolean, prefiltered: ContentMetadataItem[], filterText: string, duplicateImages: DuplicateImages): ContentMetadataItem[] {
    const filtered: ContentMetadataItem[] = showDuplicates ? prefiltered
      ?.filter(item => this.imageDuplicatesService.duplicatedContentMetadataItems(item, duplicateImages).length > 0)
      .sort(sortBy(showDuplicates ? "image" : "-date")) : prefiltered;
    return this.searchFilterPipe.transform(filtered, filterText);
  }

  filterSlides(imageTags: ImageTag[], allSlides: ContentMetadataItem[], duplicateImages: DuplicateImages, filterType: ImageFilterType, tag?: ImageTag, showDuplicates?: boolean, filterText?: string): ContentMetadataItem[] {
    this.logger.info("filterSlides:allSlides count", allSlides?.length, "tag:", tag, "showDuplicates:", showDuplicates);
    if (filterType === ImageFilterType.ALL) {
      const filteredSlides: ContentMetadataItem[] = this.filterAndSort(showDuplicates, allSlides, filterText, duplicateImages);
      this.logger.debug(filteredSlides?.length, "slides selected from", tag?.subject, "showDuplicates:", showDuplicates);
      return filteredSlides;
    } else if (filterType === ImageFilterType.RECENT) {
      const months = 6;
      const lastItems = 20;
      const items = this.filterForLastMonths(months, imageTags, showDuplicates, allSlides, filterText, tag, duplicateImages);
      this.logger.info(this.stringUtils.pluraliseWithCount(items?.length, "slide"), "returned for last", months, "months");
      return items.length === 0 ? this.filterForLastItems(lastItems, imageTags, showDuplicates, allSlides, filterText, tag, duplicateImages) : items;
    } else if (tag) {
      const filteredSlides = this.filterAndSort(showDuplicates, allSlides?.filter(file => file?.tags?.includes(tag.key)), filterText, duplicateImages);
      this.logger.debug(filteredSlides?.length, "slides selected from tag:", tag?.subject, "showDuplicates:", showDuplicates);
      return filteredSlides || [];
    }
  }

  private filterForLastMonths(months: number, imageTags: ImageTag[], showDuplicates: boolean, allSlides: ContentMetadataItem[], filterText: string, tag: ImageTag, duplicateImages: DuplicateImages) {
    const excludingKeys = this.excludeFromRecentKeys(imageTags);
    const sinceDate = this.dateUtils.dateTimeNow().minus({ months });
    const filteredSlides = this.filterAndSort(showDuplicates, allSlides?.filter(file => file.date >= sinceDate.toMillis() && !(file.tags.find(tag => excludingKeys.includes(tag)))), filterText, duplicateImages);
    this.logger.debug(filteredSlides?.length, "slides selected from", tag?.subject, "since", this.dateUtils.displayDate(sinceDate), "excludingKeys:", excludingKeys.join(", "), "showDuplicates:", showDuplicates);
    return filteredSlides;
  }

  private excludeFromRecentKeys(imageTags: ImageTag[]): number[] {
    return this.imageTagDataService.imageTagsSorted(imageTags).filter(tag => tag.excludeFromRecent).map(tag => tag.key);
  }

  private filterForLastItems(itemCount: number, imageTags: ImageTag[], showDuplicates: boolean, allSlides: ContentMetadataItem[], filterText: string, tag: ImageTag, duplicateImages: DuplicateImages) {
    const excludingKeys = this.excludeFromRecentKeys(imageTags);
    const filteredSlides = take(this.filterAndSort(showDuplicates, allSlides?.filter(file => !file.tags.find(tag => excludingKeys.includes(tag))), filterText, duplicateImages), itemCount);
    this.logger.info(filteredSlides?.length, "slides selected from", tag?.subject, "for last", itemCount, "excludingKeys:", excludingKeys.join(", "), "showDuplicates:", showDuplicates);
    return filteredSlides;
  }

  findIndex(allSlides: ContentMetadataItem[], item: ContentMetadataItem): number {
    const direct: number = allSlides.indexOf(item);
    if (direct > -1) {
      this.logger.info("findIndex:direct:", direct, "for item:", item);
      return direct;
    } else {
      const indexByMongoId = allSlides.indexOf(allSlides.find(file => file._id === item._id));
      if (indexByMongoId > 0) {
        this.logger.info("findIndex:indexByMongoId:", indexByMongoId, "for", item.image);
        return indexByMongoId;
      } else {
        const indexByImage = allSlides.indexOf(allSlides.find(file => file.image === item.image));
        if (indexByImage === -1) {
          this.logger.info("findIndex:indexByImage failed:", indexByMongoId, "for", item.image);
        } else {
          this.logger.info("findIndex:indexByImage:", indexByMongoId, "for", item.image);
        }
        this.logger.info("findIndex:returning failed:", indexByImage, "for", item.image);
        return indexByImage;
      }
    }
  }

  canMoveUp(allSlides: ContentMetadataItem[], item: ContentMetadataItem) {
    const value = this.findIndex(allSlides, item) > 0;
    this.logger.debug("canMoveUp:allSlides.length:", allSlides.length, "for", item.text, "value:", value);
    return value;
  }

  canMoveDown(allSlides: ContentMetadataItem[], item: ContentMetadataItem) {
    const value = this.findIndex(allSlides, item) < allSlides.length - 1;
    this.logger.debug("canMoveDown:allSlides.length:", allSlides.length, "for", item.text, "value:", value);
    return value;
  }

  rootFolderAndName(rootFolder: RootFolder, name: string): string {
    return rootFolder + "/" + name;
  }

  contentMetadataName(contentMetadata: ContentMetadata): string {
    return this.stringUtils.asTitle(this.stringUtils.asWords(contentMetadata?.name));
  }

  refreshLookups() {
    if (this.memberLoginService.allowContentEdits()) {
      return this.all().then(items => {
        this.carousels = items.filter(content => content.rootFolder === RootFolder.carousels)
          .map(content => content.name).sort();
      });
    } else {
      return Promise.resolve();
    }
  }

  public findMetadataFor(file: ContentMetadataItem, s3Metadata: S3Metadata[]): S3Metadata {
    return s3Metadata?.find(metadata => metadata.key.includes(file.image));
  }

  public selectMetadataBasedOn(name: string, item: ContentMetadataApiResponses): AllAndSelectedContentMetaData {
    this.logger.info("contentMetaDataItems:", item.response, "name:", name);
    const contentMetadataItems: ContentMetadata[] = item.response;
    const selection = name ? ("chosen based on name:" + name) : "chosen based on it being first as no name supplied";
    const contentMetadata: ContentMetadata = name ? contentMetadataItems.find(item => item.name === name) : first(contentMetadataItems);
    const response = {contentMetadataItems, contentMetadata};
    this.logger.info("returning:", response, selection);
    return response;
  }

  public async albumNames(): Promise<string[]> {
    const results: ContentMetadata[] = await this.all();
    return results.map(contentMetadata => contentMetadata.name);
  }
}
