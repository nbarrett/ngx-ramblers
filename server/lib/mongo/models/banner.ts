import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";

export const fileNameData = new mongoose.Schema({
    rootFolder: {type: String},
    originalFileName: {type: String},
    awsFileName: {type: String},
    title: {type: String},
}, {_id: false});


const bannerConfigSchema = new mongoose.Schema({
  name: {type: String},
  bannerType: {type: String},
  banner: {type: Object},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String},
  fileNameData
}, {collection: "banners"});

bannerConfigSchema.plugin(uniqueValidator);

export const banner: mongoose.Model<BannerConfig> = ensureModel<BannerConfig>("banner", bannerConfigSchema);
