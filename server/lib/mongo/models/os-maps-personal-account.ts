import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

export interface OsMapsPersonalAccountRecord {
  memberId: string;
  encryptedCredentials: string;
}

const schema = new mongoose.Schema({
  memberId: {type: String, unique: true, required: true},
  encryptedCredentials: {type: String, required: true}
}, {collection: "osMapsPersonalAccounts"});

export const osMapsPersonalAccount: mongoose.Model<OsMapsPersonalAccountRecord> = ensureModel("osMapsPersonalAccount", schema);
