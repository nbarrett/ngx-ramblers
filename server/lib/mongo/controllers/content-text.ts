import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { contentText } from "../models/content-text";
import * as crudController from "./crud-controller";
import { ContentText } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";

const debugLog = debug(envConfig.logNamespace("context-text"));
debugLog.enabled = false;
const controller = crudController.create<ContentText>(contentText);
export const create = controller.create;
export const all = controller.all;
export const update = controller.update;
export const deleteOne = controller.deleteOne;
