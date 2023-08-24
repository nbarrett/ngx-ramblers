import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import last from "lodash-es/last";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../models/api-request.model";
import {
  ContentMetadata,
  ContentMetadataApiResponse,
  ContentMetadataItem,
  ImageFilterType,
  ImageTag,
  S3_BASE_URL,
  S3_METADATA_URL,
  S3Metadata,
  S3MetadataApiResponse
} from "../models/content-metadata.model";
import { MemberApiResponse } from "../models/member.model";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";
import { sortBy } from "./arrays";
import { CommonDataService } from "./common-data-service";
import { DateUtilsService } from "./date-utils.service";
import { ImageDuplicatesService } from "./image-duplicates-service";
import { ImageTagDataService } from "./image-tag-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class ContentMetadataService {
  private BASE_URL = "api/database/content-metadata";
  private logger: Logger;
  private contentMetadataSubject = new Subject<ContentMetadataApiResponse>();
  private s3MetadataSubject = new Subject<S3MetadataApiResponse>();

  constructor(private http: HttpClient,
              private dateUtils: DateUtilsService,
              private searchFilterPipe: SearchFilterPipe,
              public imageTagDataService: ImageTagDataService,
              private imageDuplicatesService: ImageDuplicatesService,
              private commonDataService: CommonDataService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ContentMetadataService, NgxLoggerLevel.OFF);
  }

  contentMetadataNotifications(): Observable<MemberApiResponse> {
    return this.contentMetadataSubject.asObservable();
  }

  s3Notifications(): Observable<S3MetadataApiResponse> {
    return this.s3MetadataSubject.asObservable();
  }

  baseUrl(rootFolder: string) {
    return `${S3_BASE_URL}/${rootFolder}`;
  }

  transformFiles(contentMetaData: ContentMetadataApiResponse, contentMetaDataType: string): ContentMetadata {
    return {
      ...contentMetaData?.response, files: contentMetaData?.response?.files
        .filter(file => file?.image)
        .map(file => ({
          ...file, image: `${S3_BASE_URL}/${contentMetaDataType}/${last(file?.image?.split("/"))}`
        }))
    };
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

  async items(contentMetaDataType: string): Promise<ContentMetadata> {
    const options: DataQueryOptions = {criteria: {contentMetaDataType}};
    const params = this.commonDataService.toHttpParams(options);
    this.logger.debug("items:criteria:params", params.toString());
    const apiResponse: ContentMetadataApiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ContentMetadataApiResponse>(this.BASE_URL, {params}), this.contentMetadataSubject);
    const response = this.transformFiles(apiResponse, contentMetaDataType);
    this.logger.info("items:transformed apiResponse", response);
    return response;
  }

  async listMetaData(prefix: string): Promise<S3Metadata[]> {
    const url = `${S3_METADATA_URL}/${prefix}`;
    this.logger.debug("listMetaData:prefix", prefix, "url:", url);
    const apiResponse: S3MetadataApiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<S3MetadataApiResponse>(url), this.s3MetadataSubject);
    this.logger.debug("listMetaData:prefix", prefix, "returning", apiResponse, "S3Metadata items");
    return apiResponse.response;
  }

  filterAndSort(showDuplicates: boolean, prefiltered: ContentMetadataItem[], filterText: string): ContentMetadataItem[] {
    const filtered: ContentMetadataItem[] = showDuplicates ? prefiltered
      ?.filter(item => this.imageDuplicatesService.duplicatedContentMetadataItems(item).length > 0)
      .sort(sortBy(showDuplicates ? "image" : "-date")) : prefiltered;
    return this.searchFilterPipe.transform(filtered, filterText);
  }

  filterSlides(allSlides: ContentMetadataItem[], filterType: ImageFilterType, tag?: ImageTag, showDuplicates?: boolean, filterText?: string): ContentMetadataItem[] {
    this.logger.debug("filterSlides:allSlides count", allSlides?.length, "tag:", tag, "showDuplicates:", showDuplicates);
    if (filterType === ImageFilterType.ALL) {
      const filteredSlides: ContentMetadataItem[] = this.filterAndSort(showDuplicates, allSlides, filterText);
      this.logger.debug(filteredSlides?.length, "slides selected from", tag?.subject, "showDuplicates:", showDuplicates);
      return filteredSlides;
    } else if (filterType === ImageFilterType.RECENT) {
      const excludeFromRecentKeys: number[] = this.imageTagDataService.imageTagsSorted().filter(tag => tag.excludeFromRecent).map(tag => tag.key);
      const sinceDate = this.dateUtils.momentNow().add(-6, "months");
      const filteredSlides = this.filterAndSort(showDuplicates, allSlides?.filter(file => file.date >= sinceDate.valueOf() && !(file.tags.find(tag => excludeFromRecentKeys.includes(tag)))), filterText);
      this.logger.debug(filteredSlides?.length, "slides selected from", tag?.subject, "since", this.dateUtils.displayDate(sinceDate), "excludeFromRecentKeys:", excludeFromRecentKeys.join(", "), "showDuplicates:", showDuplicates);
      return filteredSlides;
    } else if (tag) {
      const filteredSlides = this.filterAndSort(showDuplicates, allSlides?.filter(file => file?.tags?.includes(tag.key)), filterText);
      this.logger.debug(filteredSlides?.length, "slides selected from tag:", tag?.subject, "showDuplicates:", showDuplicates);
      return filteredSlides || [];
    }
  }

  findIndex(allSlides: ContentMetadataItem[], item: ContentMetadataItem): number {
    const direct: number = allSlides.indexOf(item);
    if (direct > -1) {
      this.logger.debug("findIndex:direct:", direct, "for", item.image);
      return direct;
    } else {
      const indexByMongoId = allSlides.indexOf(allSlides.find(file => file._id === item._id));
      if (indexByMongoId > 0) {
        this.logger.debug("findIndex:indexByMongoId:", indexByMongoId, "for", item.image);
        return indexByMongoId;
      } else {
        const indexByImage = allSlides.indexOf(allSlides.find(file => file.image === item.image));
        if (indexByImage === -1) {
          this.logger.debug("findIndex:indexByImage failed:", indexByMongoId, "for", item.image);
        } else {
          this.logger.debug("findIndex:indexByImage:", indexByMongoId, "for", item.image);
        }
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

}
