import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  refreshToken: {type: String, required: true},
  memberPayload: {type: Object, required: true}
}, {collection: "refreshTokens"});

export const refreshToken: mongoose.Model<mongoose.Document> = mongoose.model("refresh-token", refreshTokenSchema);
