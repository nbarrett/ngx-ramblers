import { SystemConfig } from "../models/system.model";

export function facebookPublishingEnabled(config: SystemConfig): boolean {
  return !!config?.externalSystems?.facebook?.publishingEnabled;
}

export function instagramPublishingEnabled(config: SystemConfig): boolean {
  return !!config?.externalSystems?.instagram?.publishingEnabled;
}

export function socialPublishingEnabled(config: SystemConfig): boolean {
  return facebookPublishingEnabled(config) || instagramPublishingEnabled(config);
}
