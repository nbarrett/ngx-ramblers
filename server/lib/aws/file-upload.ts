import { isObject, map } from "lodash";
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
import { isAwsUploadErrorResponse } from "./aws-utils";
import path = require("path");

const debugLog = debug(envConfig.logNamespace("s3-file-upload"));
debugLog.enabled = true;
export { uploadFile };

function uploadFile(req, res) {

  const bulkUploadError = {error: undefined};

  debugLog("Received file request with req.query", req.query);
  const awsFileUploadResponse: AwsFileUploadResponse = {responses: [], errors: []};
  const rootFolder: string = req.query["root-folder"];
  const uploadedFiles: UploadedFile[] = req.files;
  debugLog("About to process", uploadedFiles.length, "received uploadedFiles:", uploadedFiles);
  Promise.all(uploadedFiles.map(uploadedFile => {
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
  })).then(done => {
    debugLog("Upload of ", uploadedFiles.length, "complete:success:", awsFileUploadResponse.responses.length, "errors:", awsFileUploadResponse.responses.length, "done:", done);
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

  function determineExtension(name: string): string {
    const extension = path.extname(name);
    return extension.length <= 5 ? extension : ".jpeg";
  }

  function generateFileNameData(uploadedFile: UploadedFile): ServerFileNameData {
    const parsedPath = path.parse(uploadedFile.originalname);
    const name = parsedPath.name;
    const alreadyGuid = name.length === uidFormat.length;
    const awsFileName = alreadyGuid ? uploadedFile.originalname : generateUid() + determineExtension(uploadedFile.originalname);
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
