import { memberUpdateAudit } from "../models/member-update-audit";
import * as crudController from "./crud-controller";
import { MemberUpdateAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const controller = crudController.create<MemberUpdateAudit>(memberUpdateAudit);
export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
