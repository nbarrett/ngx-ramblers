import { isObject, map } from "es-toolkit/compat";
import { AuditStatus } from "../../../projects/ngx-ramblers/src/app/models/audit";
import {
  AwsFileUploadResponse,
  AwsFileUploadResponseData,
  AwsInfo,
  AwsUploadErrorResponse,
  ServerFileNameData,
  UploadedFile
} from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { envConfig } from "../env-config/env-config";
import { generateUid, uidFormat } from "../shared/string-utils";
import * as aws from "./aws-controllers";
import debug from "debug";
import { extensionFrom, isAwsUploadErrorResponse } from "./aws-utils";
import { Request, Response } from "express";
import path = require("path");

const debugLog: debug.Debugger = debug(envConfig.logNamespace("s3-file-upload"));
debugLog.enabled = false;
export { uploadFile };

function uploadFile(req: Request, res: Response) {

  const bulkUploadError = {error: undefined};

  debugLog("Received file request with req.query", req.query);
  const awsFileUploadResponse: AwsFileUploadResponse = {responses: [], errors: []};
  const rootFolder: string = req.query["root-folder"]?.toString();
  const uploadedFiles: UploadedFile[] = req.files as UploadedFile[];
  debugLog("About to process", uploadedFiles.length, "received uploadedFiles:", uploadedFiles);
  Promise.all(uploadedFiles.map((uploadedFile: UploadedFile) => {
    const fileNameData: ServerFileNameData = generateFileNameData(uploadedFile);
    const fileUploadResponseData: AwsFileUploadResponseData = createFileUploadResponseData();
    debugAndInfo(fileUploadResponseData, "Received file", "rootFolder", rootFolder, uploadedFile.originalname, "to", uploadedFile.path,
      "containing", uploadedFile.size, "bytes", "renaming to", fileNameData.awsFileName);
    return aws.putObjectDirect(rootFolder, fileNameData.awsFileName, uploadedFile.path).then((response: AwsInfo | AwsUploadErrorResponse) => {
      if (isAwsUploadErrorResponse(response)) {
        awsFileUploadResponse.errors.push(response);
        return response;
      } else {
        fileUploadResponseData.awsInfo = response;
        fileUploadResponseData.fileNameData = fileNameData;
        fileUploadResponseData.uploadedFile = uploadedFile;
        logWithStatus(AuditStatus.info, fileUploadResponseData, "File upload completed successfully after processing", uploadedFile.path);
        awsFileUploadResponse.responses.push(fileUploadResponseData);
        return response;
      }
    });
  })).then((response: Awaited<AwsUploadErrorResponse | AwsInfo>[]) => {
    debugLog("Upload of", uploadedFiles.length, "complete:success:", awsFileUploadResponse.responses.length, "errors:", awsFileUploadResponse.errors.length, "response:", response, "returning awsFileUploadResponse:", awsFileUploadResponse);
    res.json(awsFileUploadResponse);
  });

  function createFileUploadResponseData(): AwsFileUploadResponseData {
    return {
      awsInfo: {information: null, responseData: {ETag: null}},
      fileNameData: undefined,
      uploadedFile: {
        destination: null,
        encoding: null,
        fieldname: null,
        filename: null,
        mimetype: null,
        originalname: null,
        path: null,
        size: 0
      },
      files: {}, auditLog: []
    };
  };

  function generateFileNameData(uploadedFile: UploadedFile): ServerFileNameData {
    const parsedPath = path.parse(uploadedFile.originalname);
    const name = parsedPath.name;
    const alreadyGuid = name.length === uidFormat.length;
    const awsFileName = alreadyGuid ? uploadedFile.originalname : generateUid() + extensionFrom(uploadedFile.originalname);
    debugLog("generateFileNameData:uploadedFile:", uploadedFile, "name:", name, "alreadyGuid:", alreadyGuid, "awsFileName:", awsFileName);
    return {
      rootFolder,
      originalFileName: uploadedFile.originalname,
      awsFileName
    };
  }

  function logWithStatus(status: AuditStatus, fileUploadResponseData: AwsFileUploadResponseData, ...argumentsData: any[]) {
    const debugData = map(argumentsData, item => isObject(item) ? JSON.stringify(item) : item).join(" ");
    debugLog(debugData);
    fileUploadResponseData.auditLog.push({status, message: debugData});
    if (status === "error") {
      bulkUploadError.error = debugData;
    }
  }

  function debugAndInfo(fileUploadResponseData: AwsFileUploadResponseData, ...argumentsData: any[]) {
    logWithStatus(AuditStatus.info, fileUploadResponseData, ...argumentsData);
  }

}
