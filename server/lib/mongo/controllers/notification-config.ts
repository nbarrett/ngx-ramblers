import { Request, Response } from "express";
import { values } from "es-toolkit/compat";
import * as crudController from "./crud-controller";
import { notificationConfig } from "../models/notification-config";
import { NotificationConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const controller = crudController.create<NotificationConfig>(notificationConfig);

const MANAGED_IMAGE_MARKER = "/api/aws/s3/";

function toRelativeManagedImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) {
    return imageUrl;
  }
  const markerIndex = imageUrl.indexOf(MANAGED_IMAGE_MARKER);
  return markerIndex === -1 ? imageUrl : imageUrl.slice(markerIndex + 1);
}

function stripHostsFromTemplateOverrides(config: NotificationConfig | undefined): void {
  const overrides = config?.templateOverrides;
  if (!overrides) {
    return;
  }
  values(overrides).forEach((override: { imageUrl?: string }) => {
    if (override?.imageUrl) {
      override.imageUrl = toRelativeManagedImageUrl(override.imageUrl);
    }
  });
}

export const create = (req: Request, res: Response) => {
  stripHostsFromTemplateOverrides(req.body);
  return controller.create(req, res);
};
export const update = (req: Request, res: Response) => {
  stripHostsFromTemplateOverrides(req.body);
  return controller.update(req, res);
};
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const findById = controller.findById;
