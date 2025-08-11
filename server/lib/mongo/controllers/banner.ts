import { banner } from "../models/banner";
import * as crudController from "./crud-controller";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";

const controller = crudController.create<BannerConfig>(banner);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;
