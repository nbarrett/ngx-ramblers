import mongoose from "mongoose";

const pointSchema = new mongoose.Schema({
  type: {type: String, enum: ["Point"], required: true, default: "Point"},
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
    type: {type: String, enum: ["Point", "LineString", "MultiLineString"], required: true},
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
    type: "Point" | "LineString" | "MultiLineString";
    coordinates: number[] | number[][] | number[][][];
  };
  bounds: {
    southwest: {type: "Point"; coordinates: [number, number]};
    northeast: {type: "Point"; coordinates: [number, number]};
  };
  simplified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SpatialFeatureModel = mongoose.model<SpatialFeature>("SpatialFeature", spatialFeatureSchema);
