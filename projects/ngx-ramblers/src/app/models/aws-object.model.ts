import { Dimensions } from "ngx-image-cropper";
import { AuditStatus } from "./audit";

export interface FileNameData {
  originalFileName?: string;
  awsFileName?: string;
  title?: string;
}

export interface AwsFileData {
  awsFileName?: string;
  file: File;
  image: string;
}

export interface AuditMessage {
  status: AuditStatus;
  message: string;
}

export interface ServerFileNameData {
  rootFolder: string;
  originalFileName: string;
  awsFileName: string;
}

export interface UploadedFile {
  destination: string;
  encoding: string;
  fieldname: string;
  filename: string;
  mimetype: string;
  originalname: string;
  path: string;
  size: number;
}

export interface AwsInfo {
  responseData: {
    VersionId?: string;
    ETag?: string;
    ServerSideEncryption?: string;
    $metadata?: AwsMetadata
  };
  information?: string;
}

export interface AwsFileUploadResponseData {
  auditLog: AuditMessage[],
  awsInfo: AwsInfo,
  fileNameData: ServerFileNameData,
  files: {},
  uploadedFile: UploadedFile
}

export interface AwsFileUploadResponse {
  responses: AwsFileUploadResponseData[];
  errors: AwsUploadErrorResponse[];
}

export interface AwsUploadErrorResponse {
  responseData: {
    RequestId: string;
    $fault: string;
    name: string;
    HostId: string;
    message: string;
    Code: string;
    $metadata: AwsMetadata
  };
  error?: string;
}

export interface AwsMetadata {
  totalRetryDelay?: number;
  extendedRequestId?: string;
  httpStatusCode?: number;
  attempts?: number;
}

export interface ImageData {
  base64: string;
  image: HTMLImageElement;
  size: Dimensions;
}

export interface DescribedDimensions extends Dimensions {
  description?: string;
}

export interface SelectedDescribedDimensions {
  describedDimensions: DescribedDimensions;
  preselected: boolean;
}

export interface BucketConfig {
    name: string;
    region: string;
    include?: boolean;
}

export interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
}

