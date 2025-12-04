import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { RefreshToken } from "../../../../projects/ngx-ramblers/src/app/models/auth-data.model";

const refreshTokenSchema = new mongoose.Schema({
  refreshToken: {type: String, required: true},
  memberPayload: {type: Object, required: true}
}, {collection: "refreshTokens"});

export const refreshToken: mongoose.Model<RefreshToken> = ensureModel<RefreshToken>("refresh-token", refreshTokenSchema);
