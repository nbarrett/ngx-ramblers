import express from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import * as controller from "./aws-controllers";
import { uploadFile } from "./file-upload";

const router = express.Router();

const fileUploadHandler = multer({dest: envConfig.server.uploadDir}).any();
router.post("/s3/file-upload", authConfig.authenticate(), (req, res, next) => fileUploadHandler(req, res, (error: any) => {
  if (error) {
    res.status(400).json({responses: [], errors: [{responseData: {message: error?.message || "File upload failed"}}]});
  } else {
    next();
  }
}), uploadFile);
router.get("/list-buckets", controller.listBuckets);
router.get("/metadata/list-objects", controller.listObjects);
router.get("/metadata/list-prefixes", controller.listPrefixes);
router.get("/report/:bucket/*", controller.reportObject);
router.get("/s3/:bucket*", controller.objectData);
router.get("/url-to-file", controller.urlToFile);

export const awsRoutes = router;
