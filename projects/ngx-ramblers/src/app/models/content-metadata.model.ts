import { ApiResponse, Identifiable } from "./api-response.model";
import { RootFolder } from "./system.model";
import { WithMongoId } from "./mongo-models";
import { OutputFormat } from "ngx-image-cropper";
import { ImageCropperPosition } from "./image-cropper.model";

export const RECENT_PHOTOS: ImageTag = {key: 0, sortIndex: 0, subject: "Recent Photos"};
export const ALL_PHOTOS: ImageTag = {key: -1, sortIndex: -1, subject: "All Photos"};
export const S3_BASE_URL = "api/aws/s3";
export const S3_METADATA_URL = "api/aws/metadata/list-objects";
export const BASE64_PREFIX_HEIC = "data:image/heic;base64";
export const BASE64_PREFIX_JPEG = "data:image/jpeg;base64";
export const BASE64_PREFIX_PNG = "data:image/png;base64";
export const BASE64_PREFIX_WEBP = "data:image/webp;base64";
export const IMAGE_HEIC = "image/heic";
export const IMAGE_JPEG = "image/jpeg";
export const IMAGE_PNG = "image/png";
export const IMAGE_WEBP = "image/webp";
export const IMAGE_SVG = "image/svg+xml";
export enum FileType {
  JPEG = "JPEG",
  PNG = "PNG",
  WEBP = "WEBP",
  SVG = "SVG",
  HEIC = "HEIC",
}

export interface FileTypeAttributes {
  key: FileType;
  contentType: string;
  fileExtensions: string[];
  base64Prefix: string;
  croppable: boolean;
  cropperFormat?: OutputFormat;
}

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export interface FileContentTypeMapping {
  extensions: string[];
  contentType: string;
}

export const fileContentTypeMappings: FileContentTypeMapping[] = [
  { extensions: ["jpeg", "jpg"], contentType: IMAGE_JPEG },
  { extensions: ["png", "x-png"], contentType: IMAGE_PNG },
  { extensions: ["svg"], contentType: IMAGE_SVG },
  { extensions: ["gif"], contentType: "image/gif" },
  { extensions: ["webp"], contentType: IMAGE_WEBP },
  { extensions: ["heic"], contentType: IMAGE_HEIC },
  { extensions: ["ico"], contentType: "image/x-icon" },
  { extensions: ["bmp"], contentType: "image/bmp" },
  { extensions: ["html", "htm"], contentType: "text/html; charset=utf-8" },
  { extensions: ["css"], contentType: "text/css; charset=utf-8" },
  { extensions: ["js", "mjs"], contentType: "application/javascript; charset=utf-8" },
  { extensions: ["xml"], contentType: "application/xml; charset=utf-8" },
  { extensions: ["txt"], contentType: "text/plain; charset=utf-8" },
  { extensions: ["csv"], contentType: "text/csv; charset=utf-8" },
  { extensions: ["md"], contentType: "text/markdown; charset=utf-8" },
  { extensions: ["woff"], contentType: "font/woff" },
  { extensions: ["woff2"], contentType: "font/woff2" },
  { extensions: ["ttf"], contentType: "font/ttf" },
  { extensions: ["otf"], contentType: "font/otf" },
  { extensions: ["eot"], contentType: "application/vnd.ms-fontobject" },
  { extensions: ["map"], contentType: "application/json; charset=utf-8" },
  { extensions: ["gz"], contentType: "application/gzip" },
  { extensions: ["tar"], contentType: "application/x-tar" },
  { extensions: ["pdf"], contentType: "application/pdf" },
  { extensions: ["doc", "docx", "dot"], contentType: "application/msword" },
  { extensions: ["gpx"], contentType: "application/gpx+xml" },
  { extensions: ["zip"], contentType: "application/zip" },
  { extensions: ["json", "geojson"], contentType: "application/json" }
];

export function contentTypeForExtension(extension: string): string {
  const normalised = extension.startsWith(".") ? extension.slice(1).toLowerCase() : extension.toLowerCase();
  const mapping = fileContentTypeMappings.find(entry => entry.extensions.includes(normalised));
  return mapping?.contentType || DEFAULT_CONTENT_TYPE;
}

export const fileTypeAttributes: FileTypeAttributes[] = [
  {
    key: FileType.JPEG,
    contentType: IMAGE_JPEG,
    fileExtensions: ["jpeg", "jpg"],
    base64Prefix: BASE64_PREFIX_JPEG,
    croppable: true,
    cropperFormat: "jpeg"
  },
  {
    key: FileType.PNG,
    contentType: IMAGE_PNG,
    fileExtensions: ["png"],
    base64Prefix: BASE64_PREFIX_PNG,
    croppable: true,
    cropperFormat: "png"
  },
  {
    key: FileType.HEIC,
    contentType: IMAGE_HEIC,
    fileExtensions: ["heic"],
    base64Prefix: BASE64_PREFIX_HEIC,
    croppable: true,
    cropperFormat: "jpeg"
  },
  {
    key: FileType.SVG,
    contentType: IMAGE_SVG,
    fileExtensions: ["svg"],
    base64Prefix: "",
    croppable: false
  },
  {
    key: FileType.WEBP,
    contentType: IMAGE_WEBP,
    fileExtensions: ["webp"],
    base64Prefix: BASE64_PREFIX_WEBP,
    croppable: true,
    cropperFormat: "webp"
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
  youtubeId?: string;
  cropperPosition?: ImageCropperPosition | null;
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

export interface CheckedImage {
  file: Base64File;
  isImage: boolean;
}

export interface LazyLoadingMetadata {
  contentMetadata: ContentMetadata;
  availableSlides: ContentMetadataItem[];
  selectedSlides: ContentMetadataItem[];
  activeSlideIndex: number;
}
