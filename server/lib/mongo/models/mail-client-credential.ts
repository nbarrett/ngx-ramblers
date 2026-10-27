import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MailClientCredential } from "../../../../projects/ngx-ramblers/src/app/models/mail-client.model";
import { MAIL_CLIENT_CREDENTIALS_COLLECTION } from "../migrations/shared/collection-names";

const schema = new mongoose.Schema({
  memberId: {type: String, required: true, index: true},
  label: {type: String, required: true},
  secretHash: {type: String, required: true},
  createdAt: {type: Number, required: true, index: true},
  lastUsedAt: {type: Number, default: null},
  revokedAt: {type: Number, default: null, index: true}
}, {collection: MAIL_CLIENT_CREDENTIALS_COLLECTION});

export const mailClientCredential: mongoose.Model<MailClientCredential> = ensureModel<MailClientCredential>("mail-client-credential", schema);
