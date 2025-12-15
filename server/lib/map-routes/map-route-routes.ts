import express, { Request, Response } from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { importEsriRoute } from "./map-route-import";

const router = express.Router();
const upload = multer({dest: envConfig.server.uploadDir});

router.post("/import-esri", authConfig.authenticate(), upload.single("file"), importEsriRoute);

router.post("/upload-esri", authConfig.authenticate(), upload.single("file"), (req: Request, res: Response) => {
  const uploadedFile = req.file;
  if (!uploadedFile) {
    res.status(400).json({message: "No file uploaded"});
    return;
  }
  res.status(200).json({
    filePath: uploadedFile.path,
    originalName: uploadedFile.originalname
  });
});

export const mapRouteRoutes = router;
