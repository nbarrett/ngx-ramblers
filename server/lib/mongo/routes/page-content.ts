import express from "express";
import * as authConfig from "../../auth/auth-config";
import { pageContent } from "../models/page-content";
import * as crudController from "../controllers/crud-controller";
import { PageContent } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { Request, Response } from "express";
import { ApiAction, ApiErrorCode } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";

const controller = crudController.create<PageContent>(pageContent);
const router = express.Router();

async function createWithValidation(req: Request, res: Response): Promise<void> {
  try {
    const newPageContent: PageContent = req.body;
    if (!newPageContent.path) {
      res.status(400).json({
        message: "Page content path is required",
        error: ApiErrorCode.PATH_REQUIRED
      });
    } else {
      const existing = await pageContent.findOne({ path: newPageContent.path }).exec();
      if (existing) {
        res.status(409).json({
          message: `Page content with path "${newPageContent.path}" already exists`,
          error: ApiErrorCode.DUPLICATE_PATH,
          existingId: existing._id.toString()
        });
      } else {
        await controller.create(req, res);
      }
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to create page content",
      error: error.message
    });
  }
}

router.post("", authConfig.authenticate(), createWithValidation);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const pageContentRoutes = router;
