import debug from "debug";
import { isString } from "es-toolkit/compat";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  ConvertedDocumentImage,
  DocumentConversionWorkerRequest,
  DocumentConversionWorkerResponse
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { verifyRamblersUploadSignature } from "../ramblers/integration-worker-crypto";
import { convertBufferToMarkdown } from "./document-conversion";

const debugLog = debug(envConfig.logNamespace("document-conversion-worker-routes"));
debugLog.enabled = true;

const router = express.Router();

function requestIsSigned(req: Request): boolean {
  const sharedSecret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const signature = req.headers["x-ramblers-upload-signature"];
  return isString(sharedSecret) && isString(signature) && verifyRamblersUploadSignature(JSON.stringify(req.body), sharedSecret, signature);
}

async function convertDocument(req: Request, res: Response): Promise<void> {
  if (!requestIsSigned(req)) {
    debugLog("POST /convert rejected: invalid signature");
    res.status(401).json({error: "Invalid document conversion request signature"});
    return;
  }
  const request: DocumentConversionWorkerRequest = req.body;
  if (!request?.fileName || !request?.fileBase64) {
    res.status(400).json({error: "fileName and fileBase64 are required"});
    return;
  }
  try {
    const buffer = Buffer.from(request.fileBase64, "base64");
    debugLog("POST /convert:", request.fileName, "size:", buffer.length);
    const images: ConvertedDocumentImage[] = [];
    const collectImage = async (image: {name: string; buffer: Buffer}) => {
      images.push({name: image.name, base64: image.buffer.toString("base64")});
      return `pdf-image:${image.name}`;
    };
    const result = await convertBufferToMarkdown(buffer, request.fileName, collectImage);
    const response: DocumentConversionWorkerResponse = {
      markdown: result.markdown,
      suggestedTitle: result.suggestedTitle,
      images
    };
    debugLog("POST /convert done:", request.fileName, "markdown:", result.markdown.length, "images:", images.length);
    res.json(response);
  } catch (error) {
    debugLog("POST /convert failed:", request.fileName, error);
    res.status(500).json({error: error instanceof Error ? error.message : "Document conversion failed"});
  }
}

router.post("/convert", convertDocument);

export const documentConversionWorkerRoutes = router;
