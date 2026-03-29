import express, { NextFunction, Request, Response } from "express";
import * as authConfig from "../auth/auth-config";
import { queryParishes } from "./parish-query";
import { importParishAllocations } from "./parish-csv-import";

function requireContentAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user?.contentAdmin) {
    return res.status(403).json({error: "Content admin permission required"});
  }
  next();
}

const router = express.Router();

router.get("/query", queryParishes);
router.post("/import", authConfig.authenticate(), requireContentAdmin, importParishAllocations);

export const parishRoutes = router;
