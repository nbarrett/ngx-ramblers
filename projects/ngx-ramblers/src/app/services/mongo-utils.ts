import mongoose from "mongoose";

export function isMongoId(id: string): boolean {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id).toString() === id;
  } else {
    return false;
  }
}

