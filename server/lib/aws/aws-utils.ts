import { AwsInfo, AwsUploadErrorResponse, ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import path from "path";
import { isUndefined } from "es-toolkit/compat";
import { generateUid, uidFormat } from "../shared/string-utils";
import { contentTypeForExtension } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";

export function isAwsUploadErrorResponse(response: AwsInfo | AwsUploadErrorResponse): response is AwsUploadErrorResponse {
  return !isUndefined((response as AwsUploadErrorResponse)?.error);
}

export function extensionFrom(name: string): string {
  const extension = path.extname(name);
  return extension.length <= 5 && name.includes(".") ? extension.toLowerCase() : ".jpeg";
}

export function contentTypeFrom(fileName: string): string {
  return contentTypeForExtension(path.extname(fileName));
}

export function generateAwsFileName(originalFileName: string, preserveIfGuid: boolean = true): string {
  const parsedPath = path.parse(originalFileName);
  const name = parsedPath.name;
  const extension = extensionFrom(originalFileName);

  if (preserveIfGuid && name.length === uidFormat.length) {
    return originalFileName;
  }

  return generateUid() + extension;
}

export function createFileNameData(
  rootFolder: string,
  originalFileName: string,
  awsFileName: string,
  title?: string
): ServerFileNameData {
  const data: ServerFileNameData = {
    rootFolder,
    originalFileName,
    awsFileName
  };

  if (title) {
    data.title = title;
  }

  return data;
}
