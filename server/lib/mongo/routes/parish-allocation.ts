import express, { NextFunction, Request, Response } from "express";
import * as authConfig from "../../auth/auth-config";
import * as parishAllocation from "./../controllers/parish-allocation";

function requireContentAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user?.contentAdmin) {
    return res.status(403).json({error: "Content admin permission required"});
  }
  next();
}

const router = express.Router();

router.post("/delete-all", authConfig.authenticate(), requireContentAdmin, async (req, res) => {
  try {
    const {groupCode} = req.body;
    if (!groupCode) {
      return res.status(400).json({error: "groupCode is required"});
    }
    const {parishAllocation: model} = await import("./../models/parish-allocation");
    const result = await model.deleteMany({groupCode});
    res.json({deleted: result.deletedCount});
  } catch (error) {
    res.status(500).json({error: "Failed to delete allocations"});
  }
});
router.post("", authConfig.authenticate(), requireContentAdmin, parishAllocation.create);
router.get("", parishAllocation.findByConditions);
router.get("/all", parishAllocation.all);
router.put("/:id", authConfig.authenticate(), requireContentAdmin, parishAllocation.update);
router.get("/:id", parishAllocation.findById);
router.delete("/:id", authConfig.authenticate(), requireContentAdmin, parishAllocation.deleteOne);

export const parishAllocationRoutes = router;
