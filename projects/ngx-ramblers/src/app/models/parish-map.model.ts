export interface ParishBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ParishFeatureProperties {
  PARNCP24CD: string;
  PARNCP24NM: string;
}

export interface ParishCacheEntry {
  data: GeoJSON.FeatureCollection;
  timestamp: number;
}
