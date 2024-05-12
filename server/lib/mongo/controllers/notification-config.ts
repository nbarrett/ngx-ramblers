import * as crudController from "./crud-controller";
import { notificationConfig } from "../models/notification-config";

const controller = crudController.create(notificationConfig);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;
