import { memberUpdateAudit } from "../models/member-update-audit";
import * as crudController from "./crud-controller";

const controller = crudController.create(memberUpdateAudit);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
