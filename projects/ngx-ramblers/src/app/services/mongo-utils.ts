import mongoose from "mongoose";

export function isMongoId(id: string): boolean {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id).toString() === id;
  } else {
    return false;
  }
}

export function toMongoId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

export function toMongoIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids.map(id => toMongoId(id));
}

