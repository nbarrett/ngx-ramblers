import { expenseClaim } from "../models/expense-claim";
import * as crudController from "./crud-controller";
import { ExpenseClaim } from "../../../../projects/ngx-ramblers/src/app/notifications/expenses/expense.model";

const controller = crudController.create<ExpenseClaim>(expenseClaim);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;
