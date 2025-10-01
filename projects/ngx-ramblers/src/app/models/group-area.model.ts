export interface ONSFeatureProperties {
  LAD23NM: string;
  LAD23CD?: string;
}

export interface ONSGeoJSON extends GeoJSON.FeatureCollection<GeoJSON.Polygon, ONSFeatureProperties> {}

export interface RegionGroup {
  name: string;
  url: string;
  groupCode: string;
  onsDistricts: string | string[];
  color?: string;
  nonGeographic?: boolean;
}

export interface RegionConfig {
  name: string;
  center: [number, number];
  zoom: number;
  groups: RegionGroup[];
}

export interface GroupAreaConfig {
  name: string;
  geoJsonFeature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  url: string;
  groupCode?: string;
  description?: string;
  color?: string;
}

export interface GroupAreaRegionConfig {
  name: string;
  center: [number, number];
  zoom: number;
  areas: GroupAreaConfig[];
}
