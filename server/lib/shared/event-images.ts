import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { ResolvedAlbumImage } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { S3_BASE_URL } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";

export const MAXIMUM_EVENT_IMAGES = 4;

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url || "");
}

export function s3RelativePath(fileName: string): string {
  const trimmed = (fileName || "").replace(/^\/+/, "");
  return trimmed.includes(S3_BASE_URL) ? trimmed : `${S3_BASE_URL}/${trimmed}`;
}

export function absoluteImageUrl(url: string, baseUrl: string): string {
  const trimmedBase = (baseUrl || "").replace(/\/+$/, "");
  return isRemoteUrl(url) ? url.replace(/ /g, "%20") : `${trimmedBase}/${s3RelativePath(url)}`;
}

export function eventImages(event: ExtendedGroupEvent, baseUrl: string): ResolvedAlbumImage[] {
  return (event?.groupEvent?.media || [])
    .map(media => media.styles?.find(style => style.style === "medium")?.url || media.styles?.[0]?.url)
    .filter(Boolean)
    .slice(0, MAXIMUM_EVENT_IMAGES)
    .map(url => ({image: url, url: absoluteImageUrl(url, baseUrl)}));
}

export function fallbackImageUrl(config: SystemConfig, baseUrl: string): string {
  const logo = config?.logos?.images?.find(image => image.originalFileName === config?.header?.selectedLogo)
    || config?.logos?.images?.[0];
  return logo?.awsFileName ? absoluteImageUrl(logo.awsFileName, baseUrl) : null;
}
