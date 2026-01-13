export enum SpatialFeatureGeometryType {
  POINT = "Point",
  LINE_STRING = "LineString",
  MULTI_LINE_STRING = "MultiLineString"
}

export interface SpatialFeatureGeometry {
  type: SpatialFeatureGeometryType;
  coordinates: number[] | number[][] | number[][][];
}

export interface SpatialFeatureBounds {
  southwest: {type: SpatialFeatureGeometryType.POINT; coordinates: [number, number]};
  northeast: {type: SpatialFeatureGeometryType.POINT; coordinates: [number, number]};
}

export interface SpatialFeature {
  _id: string;
  routeId: string;
  routeName: string;
  featureType: string;
  name?: string;
  description?: string;
  properties?: Record<string, unknown>;
  geometry: SpatialFeatureGeometry;
  bounds: SpatialFeatureBounds;
}

export interface ViewportBounds {
  southwest: {lat: number; lng: number};
  northeast: {lat: number; lng: number};
}

export interface ViewportFeaturesResponse {
  features: SpatialFeature[];
  totalCount: number;
  limited: boolean;
}

export interface AutocompleteSuggestion {
  value: string;
  label: string;
  description?: string;
  type: string;
}

export interface RouteStats {
  totalCount: number;
  byType: Record<string, number>;
}
