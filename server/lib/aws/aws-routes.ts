import express from "express";
import * as authConfig from "../auth/auth-config";
import * as controller from "./aws-controllers";
import { receiveFileUpload, uploadFile } from "./file-upload";

const router = express.Router();

router.post("/s3/file-upload", authConfig.authenticate(), receiveFileUpload, uploadFile);
router.get("/list-buckets", controller.listBuckets);
router.get("/metadata/list-objects", controller.listObjects);
router.get("/metadata/list-prefixes", controller.listPrefixes);
router.get("/report/:bucket/*", controller.reportObject);
router.get("/s3/:bucket*", controller.objectData);
router.get("/url-to-file", controller.urlToFile);

export const awsRoutes = router;
