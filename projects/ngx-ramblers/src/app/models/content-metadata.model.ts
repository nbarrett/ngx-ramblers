import { ApiResponse, WithMongoId } from "./api-response.model";
import { RootFolder } from "./system.model";

export const RECENT_PHOTOS: ImageTag = {key: 0, sortIndex: 0, subject: "Recent Photos"};
export const ALL_PHOTOS: ImageTag = {key: -1, sortIndex: -1, subject: "All Photos"};
export const S3_BASE_URL = "api/aws/s3";
export const S3_METADATA_URL = "api/aws/metadata/list-objects";
export const BASE64_PREFIX_JPEG = "data:image/jpeg;base64";
export const BASE64_PREFIX_PNG = "data:image/png;base64";

export interface ContentMetadata {
  id: string;
  rootFolder?: RootFolder;
  name?: string;
  files: ContentMetadataItem[];
  coverImage: string;
  imageTags: ImageTag[];
  aspectRatio?: string;
  defaultImage?: string;
}

export interface S3Metadata {
  key: string;
  lastModified: number;
  size: number;
}

export interface S3MetadataApiResponse extends ApiResponse {
  request: any;
  response?: S3Metadata[];
}

export interface ContentMetadataItem extends WithMongoId {
  eventId?: string;
  dateSource?: string;
  date?: number;
  image?: string;
  originalFileName?: string;
  text?: string;
  tags?: number[];
}

export interface DuplicateImages {
  [image: string]: ContentMetadataItem[];
}

export interface ContentMetadataApiResponse extends ApiResponse {
  request: any;
  response?: ContentMetadata;
}

export interface ContentMetadataApiResponses extends ApiResponse {
  request: any;
  response?: ContentMetadata[];
}

export interface AllAndSelectedContentMetaData {
  contentMetadataItems: ContentMetadata[];
  contentMetadata: ContentMetadata;
}

export interface ImageTag {
  key?: number;
  sortIndex?: number;
  subject: string;
  excludeFromRecent?: boolean;
}

export enum ImageFilterType {
  ALL = "all",
  RECENT = "recent",
  TAG = "tag"
}

export enum SlideInitialisation {
  COMPONENT_INIT = "component-init",
  TAG_CHANGE = "tag-change"
}

export interface LazyLoadingMetadata {
  contentMetadata: ContentMetadata;
  availableSlides: ContentMetadataItem[];
  selectedSlides: ContentMetadataItem[];
  activeSlideIndex: number;
}
