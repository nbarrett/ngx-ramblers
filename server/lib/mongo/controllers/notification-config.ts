import { Request, Response } from "express";
import { isString, values } from "es-toolkit/compat";
import * as crudController from "./crud-controller";
import { notificationConfig } from "../models/notification-config";
import { NotificationConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { storedAwsImagePath, storedAwsImageUrls } from "../../../../projects/ngx-ramblers/src/app/functions/aws-image-paths";

const controller = crudController.create<NotificationConfig>(notificationConfig);

function normaliseStoredImages(config: NotificationConfig | null): void {
  if (config) {
    if (isString(config.body)) {
      config.body = storedAwsImageUrls(config.body);
    }
    values(config.templateOverrides || {}).forEach(override => {
      if (override?.imageUrl) {
        override.imageUrl = storedAwsImagePath(override.imageUrl);
      }
      if (isString(override?.content)) {
        override.content = storedAwsImageUrls(override.content);
      }
    });
  }
}

export const create = (req: Request, res: Response) => {
  normaliseStoredImages(req.body);
  return controller.create(req, res);
};
export const update = (req: Request, res: Response) => {
  normaliseStoredImages(req.body);
  return controller.update(req, res);
};
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const findById = controller.findById;
