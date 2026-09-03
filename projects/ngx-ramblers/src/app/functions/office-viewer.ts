import { OFFICE_FILE_EXTENSIONS } from "../models/aws-object.model";

const OFFICE_CONTENT_TYPE_MARKERS = ["msword", "ms-excel", "ms-powerpoint", "officedocument", "opendocument"];

export function isOfficeFileName(fileName: string | null | undefined): boolean {
  const extension = (fileName || "").split("?")[0].split(".").pop()?.toLowerCase() || "";
  return OFFICE_FILE_EXTENSIONS.includes(extension);
}

export function isOfficeContentType(contentType: string | null | undefined): boolean {
  const value = (contentType || "").toLowerCase();
  return OFFICE_CONTENT_TYPE_MARKERS.some(marker => value.includes(marker));
}

export function officeViewerUrl(publicSourceUrl: string): string {
  return publicSourceUrl ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(publicSourceUrl)}` : "";
}

export function officeViewerEmbedUrl(publicSourceUrl: string): string {
  return publicSourceUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicSourceUrl)}` : "";
}
