import express from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import * as controller from "./aws-controllers";
import { uploadFile } from "./file-upload";

const router = express.Router();

router.post("/s3/file-upload", authConfig.authenticate(), multer({dest: envConfig.server.uploadDir}).any(), uploadFile);
router.get("/list-buckets", controller.listBuckets);
router.get("/metadata/list-objects", controller.listObjects);
router.get("/s3/:bucket*", controller.getObject);
router.get("/url-to-file", controller.urlToFile);

export const awsRoutes = router;
