import mongoose, { Model, Schema } from "mongoose";

export function ensureModel<T>(modelName: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[modelName] as Model<T>) || mongoose.model<T>(modelName, schema);
}
