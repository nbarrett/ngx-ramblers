import { AwsInfo, AwsUploadErrorResponse } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import path from "path";

export function isAwsUploadErrorResponse(response: AwsInfo | AwsUploadErrorResponse): response is AwsUploadErrorResponse {
  return (response as AwsUploadErrorResponse)?.error !== undefined;
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
  } else {
    return "image/jpeg";
  }
}
