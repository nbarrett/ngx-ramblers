export type S3UploadProgressCallback = (bucket: string, key: string) => unknown;

export interface S3UploadItem {
  localPath: string;
  key: string;
  contentType: string;
  contentLength: number;
}
