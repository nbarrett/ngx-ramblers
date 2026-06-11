import express, { Request, Response } from "express";
import multer from "multer";
import * as fs from "fs";
import debug from "debug";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { objectBufferForKey, putBufferDirect } from "../aws/aws-controllers";
import { v4 as uuid } from "uuid";
import { ExtractedPdfImage } from "./pdf-styled-extraction";
import committeeFile from "../mongo/models/committee-file";
import { convertBufferToMarkdown, replacePdfImagePlaceholders } from "./document-conversion";
import { convertDocumentViaIntegrationWorker, documentConversionWorkerConfigured } from "./document-conversion-worker-client";
import { DocumentConversionResponse } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

const CONVERTED_IMAGES_FOLDER = "committeeFiles/converted-images";

async function convertWithBestEngine(buffer: Buffer, fileName: string): Promise<DocumentConversionResponse> {
  if (documentConversionWorkerConfigured()) {
    try {
      const workerResult = await convertDocumentViaIntegrationWorker(buffer, fileName);
      const imagePaths = new Map<string, string | null>();
      for (const image of workerResult.images) {
        const uploadedPath = await uploadConvertedImage({
          name: image.name,
          buffer: Buffer.from(image.base64, "base64"),
          pageNumber: 0,
          width: 0,
          height: 0
        });
        imagePaths.set(image.name, uploadedPath);
      }
      return {
        markdown: replacePdfImagePlaceholders(workerResult.markdown, imagePaths),
        suggestedTitle: workerResult.suggestedTitle
      };
    } catch (error) {
      debugLog("integration worker conversion failed, falling back to in-process conversion:", error);
    }
  }
  return convertBufferToMarkdown(buffer, fileName, uploadConvertedImage);
}

async function uploadConvertedImage(image: ExtractedPdfImage): Promise<string | null> {
  const fileName = `${uuid()}.png`;
  const result = await putBufferDirect(CONVERTED_IMAGES_FOLDER, fileName, image.buffer, "image/png");
  if ("error" in result) {
    debugLog("image upload failed:", result.error);
    return null;
  } else {
    return `api/aws/s3/${CONVERTED_IMAGES_FOLDER}/${fileName}`;
  }
}

const debugLog = debug(envConfig.logNamespace("document-conversion-routes"));
debugLog.enabled = false;

function candidateS3Keys(fileNameData: { rootFolder?: string; awsFileName?: string }): string[] {
  const awsFileName = fileNameData?.awsFileName || "";
  const rootFolder = fileNameData?.rootFolder || "committeeFiles";
  const candidates = awsFileName.includes("/")
    ? [awsFileName, `${rootFolder}/${awsFileName.split("/").pop()}`]
    : [`${rootFolder}/${awsFileName}`, awsFileName];
  return Array.from(new Set(candidates.filter(candidate => candidate.length > 0)));
}

async function remoteBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download the source file (${response.status}) from ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function attachmentBuffer(fileNameData: { rootFolder?: string; awsFileName?: string }): Promise<Buffer> {
  const awsFileName = fileNameData?.awsFileName || "";
  if (/^https?:\/\//.test(awsFileName)) {
    return remoteBuffer(awsFileName);
  } else {
    const keys = candidateS3Keys(fileNameData);
    return keys.reduce((previous: Promise<Buffer>, key) => previous.catch(() => objectBufferForKey(key)),
      Promise.reject(new Error("no candidate keys")))
      .catch(error => {
        debugLog("attachmentBuffer failed for keys:", keys, "error:", error);
        throw new Error(`The stored file could not be found in file storage (tried ${keys.join(", ")}) - ${error.message}`);
      });
  }
}

async function convertUploadedFile(req: Request, res: Response): Promise<void> {
  const uploadedFile = (req as any).file;
  if (!uploadedFile) {
    res.status(400).json({request: {}, error: "No file was uploaded"});
  } else {
    try {
      const buffer = await fs.promises.readFile(uploadedFile.path);
      const response = await convertWithBestEngine(buffer, uploadedFile.originalname);
      res.json({request: {fileName: uploadedFile.originalname}, response});
    } catch (error) {
      debugLog("convertUploadedFile failed:", error);
      res.status(400).json({request: {fileName: uploadedFile.originalname}, error: error.message});
    } finally {
      await fs.promises.unlink(uploadedFile.path).catch(unlinkError => debugLog("temp file cleanup failed:", unlinkError));
    }
  }
}

async function convertCommitteeFile(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  try {
    const document = await committeeFile.findById(id);
    const fileNameData = (document as any)?.fileNameData;
    if (!fileNameData?.awsFileName) {
      res.status(400).json({request: {id}, error: "Committee file has no attachment to convert"});
    } else {
      const buffer = await attachmentBuffer(fileNameData);
      const response = await convertWithBestEngine(buffer, fileNameData.originalFileName || fileNameData.awsFileName);
      res.json({request: {id}, response});
    }
  } catch (error) {
    debugLog("convertCommitteeFile failed:", error);
    res.status(400).json({request: {id}, error: error.message});
  }
}

const router = express.Router();

router.post("/file", authConfig.authenticate(), multer({dest: envConfig.server.uploadDir}).single("file"), convertUploadedFile);
router.post("/committee-file/:id", authConfig.authenticate(), convertCommitteeFile);

export default router;
