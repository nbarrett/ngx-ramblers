import { ServerFileNameData } from "./aws-object.model";

export interface MapRouteImportMetadata {
  featureCount: number;
  geometryTypes: string[];
  coordinateReferenceSystem?: string;
  bounds?: [number, number, number, number] | [number, number, number, number, number, number];
  warnings?: string[];
  sourceCrs?: string;
  transformApplied?: string;
}

export interface MapRouteImportGroupedFile {
  type: string;
  count: number;
  file: ServerFileNameData;
  fileSizeBytes?: number;
  routeId?: string;
}

export interface MapRouteImportResponse {
  routeName: string;
  gpxFile: ServerFileNameData;
  gpxFiles?: MapRouteImportGroupedFile[];
  esriFile: ServerFileNameData;
  metadata: MapRouteImportMetadata;
}
