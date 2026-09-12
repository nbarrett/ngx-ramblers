import { keys } from "es-toolkit/compat";
import { RamblersWalksManagerDateFormat, UIDateFormat } from "./date-format.model";

export enum SerenityFeature {
  WALKS_UPLOAD = "walks-upload.ts",
  OS_MAPS_EXPORT = "os-maps-export.ts",
  OS_MAPS_LIST = "os-maps-list.ts"
}

export interface SerenityFeatureFileName {
  prefix: string;
  extension: string;
  timestampPattern: string;
  timestampFormat: string;
}

export const SERENITY_FEATURE_FILE_NAMES: Record<SerenityFeature, SerenityFeatureFileName> = {
  [SerenityFeature.WALKS_UPLOAD]: {
    prefix: "walks-export-",
    extension: "csv",
    timestampPattern: "\\d{1,2}-\\w+-\\d{4}-\\d{2}-\\d{2}",
    timestampFormat: RamblersWalksManagerDateFormat.EXPORT_FILENAME
  },
  [SerenityFeature.OS_MAPS_EXPORT]: {
    prefix: "os-maps-export-",
    extension: "gpx",
    timestampPattern: "\\d{8}-\\d{6}",
    timestampFormat: UIDateFormat.FILE_TIMESTAMP_COMPACT
  },
  [SerenityFeature.OS_MAPS_LIST]: {
    prefix: "os-maps-list-",
    extension: "json",
    timestampPattern: "\\d{8}-\\d{6}",
    timestampFormat: UIDateFormat.FILE_TIMESTAMP_COMPACT
  }
};

export function isSerenityFeature(value: string): value is SerenityFeature {
  return serenityFeatures().includes(value as SerenityFeature);
}

export function serenityFeatures(): SerenityFeature[] {
  return keys(SERENITY_FEATURE_FILE_NAMES) as SerenityFeature[];
}

export function serenityFeatureFileNamePattern(feature: SerenityFeature): RegExp {
  const fileName = SERENITY_FEATURE_FILE_NAMES[feature];
  return new RegExp(`^${fileName.prefix}(${fileName.timestampPattern})\\.${fileName.extension}$`);
}

export function serenityFeatureFromFileName(fileName: string): SerenityFeature {
  return serenityFeatures().find(feature => fileName?.startsWith(SERENITY_FEATURE_FILE_NAMES[feature].prefix)) || SerenityFeature.WALKS_UPLOAD;
}

export function resolvedSerenityFeature(fileName: string, storedFeature?: string): SerenityFeature {
  if (storedFeature && isSerenityFeature(storedFeature)) {
    return storedFeature;
  } else {
    return serenityFeatureFromFileName(fileName);
  }
}
