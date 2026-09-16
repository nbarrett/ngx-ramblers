import mongoose, { Connection, Model, Schema } from "mongoose";

export function ensureModel<T>(modelName: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[modelName] as Model<T>) || mongoose.model<T>(modelName, schema);
}

export function modelOnConnection<T>(connection: Connection, modelName: string, schema: Schema<T>): Model<T> {
  return connection.model<T>(modelName, schema);
}
