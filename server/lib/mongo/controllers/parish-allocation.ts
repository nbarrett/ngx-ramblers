import { parishAllocation } from "../models/parish-allocation";
import * as crudController from "./crud-controller";
import { ParishAllocation } from "../../../../projects/ngx-ramblers/src/app/models/parish-map.model";

const controller = crudController.create<ParishAllocation>(parishAllocation);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;
