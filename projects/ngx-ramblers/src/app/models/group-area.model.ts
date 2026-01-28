import { SharedDistrictStyle } from "./system.model";

export interface ONSFeatureProperties {
  LAD23NM: string;
  LAD23CD?: string;
}

export interface ONSGeoJSON extends GeoJSON.FeatureCollection<GeoJSON.Polygon, ONSFeatureProperties> {}

export interface RegionGroup {
  name: string;
  url: string;
  externalUrl?: string;
  groupCode: string;
  onsDistricts: string | string[];
  color?: string;
  nonGeographic?: boolean;
}

export interface SharedDistrictInfo {
  groups: { name: string; color: string }[];
}

export interface RegionConfig {
  name: string;
  center: [number, number];
  zoom: number;
  groups: RegionGroup[];
  sharedDistricts?: Record<string, SharedDistrictInfo>;
  sharedDistrictStyle?: SharedDistrictStyle;
  mainAreaGroupCodes?: string[];
}

export interface GroupAreaConfig {
  name: string;
  geoJsonFeature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  url: string;
  externalUrl?: string;
  groupCode?: string;
  description?: string;
  color?: string;
}

export interface GroupAreaRegionConfig {
  name: string;
  center: [number, number];
  zoom: number;
  areas: GroupAreaConfig[];
  sharedDistricts?: Record<string, SharedDistrictInfo>;
  sharedDistrictStyle?: SharedDistrictStyle;
  mainAreaGroupCodes?: string[];
}
