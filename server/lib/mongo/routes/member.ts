import express, { Request, Response } from "express";
import { isArray, isString } from "es-toolkit/compat";
import * as authConfig from "../../auth/auth-config";
import * as member from "../controllers/member";
import { bulkDeleteMembersCascade } from "../controllers/member-bulk-delete";
const router = express.Router();

router.post("", authConfig.authenticate(), member.create);
router.get("/find-one", authConfig.authenticate(), member.findOne);
router.get("/all", authConfig.authenticate(), member.all);
router.post("/all", authConfig.authenticate(), member.createOrUpdateAll);
router.post("/delete-all", authConfig.authenticate(), member.deleteAll);
router.post("/bulk-delete", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const memberIds: string[] = isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => isString(id) && id.length > 0) : [];
    const deletedBy: string = (req.user as any)?.memberId ?? "";
    const result = await bulkDeleteMembersCascade(memberIds, deletedBy);
    res.status(200).json({action: `Bulk deletion of ${memberIds.length} member(s)`, response: result.deletionResponses});
  } catch (error: any) {
    res.status(500).json({error: error?.message || "bulk-delete failed"});
  }
});
router.put("/:id", authConfig.authenticate(), member.update);
router.put("/:id/email-subscription", member.updateEmailSubscription);
router.delete("/:id", authConfig.authenticate(), member.deleteOne);
router.get("/:id", authConfig.authenticate(), member.findById);
router.get("/password-reset-id/:id", member.findByPasswordResetId);

export const memberRoutes = router;
