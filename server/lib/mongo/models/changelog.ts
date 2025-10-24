import mongoose from "mongoose";

export interface ChangelogEntry {
  fileName: string;
  appliedAt?: Date;
  error?: string;
  simulated?: boolean;
}

const changelogSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  appliedAt: { type: Date },
  error: { type: String },
  simulated: { type: Boolean, default: false }
}, { collection: "changelog" });

export const changelog: mongoose.Model<ChangelogEntry> =
  mongoose.model<ChangelogEntry>("changelog", changelogSchema);
