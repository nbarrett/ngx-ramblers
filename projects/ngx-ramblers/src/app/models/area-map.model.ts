export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelRect {
  min: PixelPoint;
  max: PixelPoint;
}

export interface LabelSize {
  width: number;
  height: number;
}

export interface LabelPlacement {
  point: PixelPoint;
  bounds: PixelRect;
}

export interface GeoBoundsCorners {
  southWest: GeoPoint;
  northEast: GeoPoint;
}

export interface AreaMapLegendItem {
  name: string;
  color: string;
}

export interface RenderableGeoJsonFeature {
  type?: string;
  features?: unknown[];
  geometry?: {coordinates?: unknown[]};
}

export interface ParishOverlayStyle {
  allocatedColor: string;
  vacantColor: string;
  borderColor: string;
  fillOpacity: number;
}

export enum ParishCoverageFilter {
  LFO_COVERED = "LFO covered",
  LFO_VACANT = "LFO vacant",
  PFO_COVERED = "PFO covered",
  PFO_VACANT = "PFO vacant",
  TEMPORARY_COVER = "Temporary cover"
}

export interface ParishFilterSelectOption {
  value: string;
  label: string;
}

export enum ParishColourMode {
  COVERAGE = "coverage",
  RIGHTS_OF_WAY_GROUP = "rights-of-way-group",
  LOCAL_AUTHORITY = "local-authority",
  SECTOR = "sector"
}

export interface ParishColourModeOption {
  value: ParishColourMode;
  label: string;
}

export interface ParishColourLegendItem {
  label: string;
  color: string;
}

export interface ParishOverlayFilter {
  coverage: ParishCoverageFilter[];
  rightsOfWayGroupCode: string[];
  localAuthorityCode: string[];
  sectorCode: string[];
}
