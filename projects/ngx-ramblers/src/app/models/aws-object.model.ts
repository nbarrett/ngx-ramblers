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
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number
}

export interface AwsInfo {
  responseData: {
    ETag?: string;
  },
  information?: string;
  error?: any;
}

export interface AwsFileUploadResponseData {
  files: {},
  auditLog: AuditMessage[],
  awsInfo: AwsInfo,
  fileNameData: ServerFileNameData,
  uploadedFile: UploadedFile
}

export interface AwsFileUploadResponse {
  response: AwsFileUploadResponseData
  error?: any;
}

export interface ImageData {
  base64: string;
  image: HTMLImageElement;
  size: Dimensions;
}

export interface DescribedDimensions extends Dimensions {
  description?: string;
}
