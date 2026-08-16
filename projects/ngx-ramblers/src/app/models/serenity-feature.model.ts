export enum SerenityFeature {
  WALKS_UPLOAD = "walks-upload.ts",
  OS_MAPS_EXPORT = "os-maps-export.ts",
  OS_MAPS_LIST = "os-maps-list.ts"
}

export function isSerenityFeature(value: string): value is SerenityFeature {
  return value === SerenityFeature.WALKS_UPLOAD
    || value === SerenityFeature.OS_MAPS_EXPORT
    || value === SerenityFeature.OS_MAPS_LIST;
}

export function serenityFeatureFromFileName(fileName: string): SerenityFeature {
  if (!fileName) {
    return SerenityFeature.WALKS_UPLOAD;
  } else if (fileName.startsWith("os-maps-export-")) {
    return SerenityFeature.OS_MAPS_EXPORT;
  } else if (fileName.startsWith("os-maps-list-")) {
    return SerenityFeature.OS_MAPS_LIST;
  } else {
    return SerenityFeature.WALKS_UPLOAD;
  }
}

export function resolvedSerenityFeature(fileName: string, storedFeature?: string): SerenityFeature {
  if (storedFeature && isSerenityFeature(storedFeature)) {
    return storedFeature;
  } else {
    return serenityFeatureFromFileName(fileName);
  }
}
