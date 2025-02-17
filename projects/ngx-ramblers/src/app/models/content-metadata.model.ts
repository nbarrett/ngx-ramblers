import { ApiResponse, Identifiable } from "./api-response.model";
import { RootFolder } from "./system.model";
import { WithMongoId } from "./mongo-models";
import { OutputFormat } from "ngx-image-cropper/lib/interfaces/cropper-options.interface";

export const RECENT_PHOTOS: ImageTag = {key: 0, sortIndex: 0, subject: "Recent Photos"};
export const ALL_PHOTOS: ImageTag = {key: -1, sortIndex: -1, subject: "All Photos"};
export const S3_BASE_URL = "api/aws/s3";
export const S3_METADATA_URL = "api/aws/metadata/list-objects";
export const BASE64_PREFIX_JPEG = "data:image/jpeg;base64";
export const IMAGE_JPEG = "image/jpeg";
export const IMAGE_PNG = "image/png";
export const BASE64_PREFIX_PNG = "data:image/png;base64";

export enum FileType {
  JPEG = "JPEG",
  PNG = "PNG",
  SVG = "SVG",
}

export interface FileTypeAttributes {
  key: FileType;
  contentType: string;
  fileExtensions: string[];
  base64Prefix: string;
  croppable: boolean;
  cropperFormat?: OutputFormat;
}

export const fileTypeAttributes: FileTypeAttributes[] = [
  {
    key: FileType.JPEG,
    contentType: "image/jpeg",
    fileExtensions: ["jpeg", "jpg"],
    base64Prefix: BASE64_PREFIX_JPEG,
    croppable: true,
    cropperFormat: "jpeg"
  },
  {
    key: FileType.PNG,
    contentType: "image/png",
    fileExtensions: ["png"],
    base64Prefix: BASE64_PREFIX_PNG,
    croppable: false,
    cropperFormat: "png"
  },
  {
    key: FileType.SVG,
    contentType: "image/svg+xml",
    fileExtensions: ["svg"],
    base64Prefix: "",
    croppable: false
  }];

export interface ContentMetadata extends Identifiable {
  rootFolder?: RootFolder;
  name?: string;
  files: ContentMetadataItem[];
  coverImage?: string;
  imageTags: ImageTag[];
  aspectRatio?: string;
  defaultImage?: string;
  maxImageSize?: number;
}

export interface ContentMetadataResizeRequest {
  maxFileSize: number;
  id?: string;
  input?: ContentMetadataItem[];
  output?: {
    rootFolder: RootFolder;
    name: string;
  };
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

export interface HasEventId {
  eventId?: string;
  dateSource?: string;
}

export interface ContentMetadataItem extends WithMongoId, HasEventId {
  date?: number;
  image?: string;
  base64Content?: string;
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

export interface ContentMetadataItemsApiResponse extends ApiResponse {
  request: any;
  response: ContentMetadataItem[];
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

export interface Base64File {
  file: File
  base64Content: string;
}

export interface LazyLoadingMetadata {
  contentMetadata: ContentMetadata;
  availableSlides: ContentMetadataItem[];
  selectedSlides: ContentMetadataItem[];
  activeSlideIndex: number;
}
