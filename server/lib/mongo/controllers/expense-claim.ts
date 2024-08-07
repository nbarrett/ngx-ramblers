import { expenseClaim } from "../models/expense-claim";
import * as crudController from "./crud-controller";

const controller = crudController.create(expenseClaim);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;
