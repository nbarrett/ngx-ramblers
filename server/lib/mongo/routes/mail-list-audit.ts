import express, { Request, Response } from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import { mailListAudit } from "../models/mail-list-audit";
import { member } from "../models/member";
import { MailListAudit } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { isArray, isString } from "es-toolkit/compat";
import debug from "debug";

const debugLog = debug("ngx-ramblers:mail-list-audit-routes");
const controller = crudController.create<MailListAudit>(mailListAudit);
const router = express.Router();

router.post("/delete-by-members", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const memberIds: string[] = isArray(req.body?.memberIds) ? req.body.memberIds.filter((id: unknown): id is string => isString(id) && id.length > 0) : [];
    if (memberIds.length === 0) {
      res.json({ deleted: 0 });
      return;
    }
    const result = await mailListAudit.deleteMany({ memberId: { $in: memberIds } });
    debugLog("delete-by-members:", memberIds.length, "memberIds → deleted", result.deletedCount, "audit rows");
    res.json({ deleted: result.deletedCount || 0 });
  } catch (error: any) {
    debugLog("delete-by-members:failed", error);
    res.status(500).json({ error: error?.message || "delete-by-members failed" });
  }
});

router.post("/delete-orphans", authConfig.authenticate(), async (_req: Request, res: Response) => {
  try {
    const validIds: string[] = (await member.distinct("_id")).map(id => id?.toString()).filter(Boolean);
    const result = await mailListAudit.deleteMany({
      memberId: { $exists: true, $ne: null, $nin: validIds }
    });
    debugLog("delete-orphans: validMemberIds=", validIds.length, "→ deleted", result.deletedCount, "orphan audit rows");
    res.json({ deleted: result.deletedCount || 0 });
  } catch (error: any) {
    debugLog("delete-orphans:failed", error);
    res.status(500).json({ error: error?.message || "delete-orphans failed" });
  }
});

router.post("", authConfig.authenticate(), controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", controller.all);
router.post("/all", controller.createOrUpdateAll);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const mailListAuditRoutes = router;
