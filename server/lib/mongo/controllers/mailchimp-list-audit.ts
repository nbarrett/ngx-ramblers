import { mailchimpListAudit } from "../models/mailchimp-list-audit";
import * as crudController from "./crud-controller";
import { MailchimpListAudit } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";

const controller = crudController.create<MailchimpListAudit>(mailchimpListAudit);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;
