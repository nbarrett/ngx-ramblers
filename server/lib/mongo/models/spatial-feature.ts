import mongoose from "mongoose";
import { values } from "es-toolkit/compat";

export enum SpatialFeatureGeometryType {
  POINT = "Point",
  LINE_STRING = "LineString",
  MULTI_LINE_STRING = "MultiLineString"
}

const pointSchema = new mongoose.Schema({
  type: {type: String, enum: [SpatialFeatureGeometryType.POINT], required: true, default: SpatialFeatureGeometryType.POINT},
  coordinates: {type: [Number], required: true}
}, {_id: false});

const spatialFeatureSchema = new mongoose.Schema({
  routeId: {type: String, required: true, index: true},
  routeName: {type: String, required: true},
  featureType: {type: String, required: true, index: true},
  name: {type: String, index: true},
  description: {type: String},
  properties: {type: mongoose.Schema.Types.Mixed},
  geometry: {
    type: {type: String, enum: values(SpatialFeatureGeometryType), required: true},
    coordinates: {type: mongoose.Schema.Types.Mixed, required: true}
  },
  bounds: {
    southwest: {type: pointSchema, required: true},
    northeast: {type: pointSchema, required: true}
  },
  simplified: {type: Boolean, default: false},
  createdAt: {type: Date, default: Date.now, index: true}
}, {
  collection: "spatialFeatures",
  timestamps: true
});

spatialFeatureSchema.index({routeId: 1, featureType: 1});
spatialFeatureSchema.index({name: "text", description: "text"});
spatialFeatureSchema.index({"bounds.southwest.coordinates.0": 1, "bounds.southwest.coordinates.1": 1});
spatialFeatureSchema.index({"bounds.northeast.coordinates.0": 1, "bounds.northeast.coordinates.1": 1});

export interface SpatialFeature extends mongoose.Document {
  routeId: string;
  routeName: string;
  featureType: string;
  name?: string;
  description?: string;
  properties?: Record<string, unknown>;
  geometry: {
    type: SpatialFeatureGeometryType;
    coordinates: number[] | number[][] | number[][][];
  };
  bounds: {
    southwest: {type: SpatialFeatureGeometryType.POINT; coordinates: [number, number]};
    northeast: {type: SpatialFeatureGeometryType.POINT; coordinates: [number, number]};
  };
  simplified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SpatialFeatureModel = mongoose.model<SpatialFeature>("SpatialFeature", spatialFeatureSchema);
