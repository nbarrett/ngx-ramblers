import { AwsInfo, AwsUploadErrorResponse, ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import path from "path";
import { isUndefined } from "es-toolkit/compat";
import { generateUid, uidFormat } from "../shared/string-utils";

export function isAwsUploadErrorResponse(response: AwsInfo | AwsUploadErrorResponse): response is AwsUploadErrorResponse {
  return !isUndefined((response as AwsUploadErrorResponse)?.error);
}

export function extensionFrom(name: string): string {
  const extension = path.extname(name);
  return extension.length <= 5 && name.includes(".") ? extension.toLowerCase() : ".jpeg";
}

export function contentTypeFrom(fileName: string): string {
  const extension = extensionFrom(fileName);
  if ([".jpg", ".jpeg"].includes(extension)) {
    return "image/jpeg";
  } else if ([".png", ".x-png"].includes(extension)) {
    return "image/png";
  } else if ([".svg"].includes(extension)) {
    return "image/svg+xml";
  } else if ([".pdf"].includes(extension)) {
    return "application/pdf";
  } else if ([".doc", ".docx", ".dot"].includes(extension)) {
    return "application/msword";
  } else if ([".gpx"].includes(extension)) {
    return "application/gpx+xml";
  } else if ([".zip"].includes(extension)) {
    return "application/zip";
  } else if ([".json", ".geojson"].includes(extension)) {
    return "application/json";
  } else {
    return "application/octet-stream";
  }
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
