import { first, isObject, map } from "lodash";
import { AuditStatus } from "../../../projects/ngx-ramblers/src/app/models/audit";
import {
  AwsFileUploadResponse,
  AwsFileUploadResponseData,
  ServerFileNameData,
  UploadedFile
} from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { envConfig } from "../env-config/env-config";
import { generateUid, uidFormat } from "../shared/string-utils";
import * as aws from "./aws-controllers";
import debug from "debug";
import path = require("path");

const debugLog = debug(envConfig.logNamespace("s3-file-upload"));

export { uploadFile };

function uploadFile(req, res) {

  const bulkUploadResponse: AwsFileUploadResponseData = {
    awsInfo: {information: null, responseData: {ETag: null}},
    fileNameData: undefined,
    uploadedFile: {destination: null, encoding: null, fieldname: null, filename: null, mimetype: null, originalname: null, path: null, size: 0},
    files: {}, auditLog: []
  };
  const bulkUploadError = {error: undefined};

  debugAndInfo("Received file request with req.query", req.query);
  const rootFolder: string = req.query["root-folder"];
  const uploadedFile: UploadedFile = uploadedFileInfo();
  const fileNameData: ServerFileNameData = generateFileNameData(uploadedFile);

  debugAndInfo("Received file", "rootFolder", rootFolder, uploadedFile.originalname, "to", uploadedFile.path,
    "containing", uploadedFile.size, "bytes", "renaming to", fileNameData.awsFileName);
  aws.putObjectDirect(rootFolder, fileNameData.awsFileName, uploadedFile.path).then((response: any) => {
    if (response.error) {
      return res.status(500).json(response);
    } else {
      bulkUploadResponse.awsInfo = response;
      bulkUploadResponse.fileNameData = fileNameData;
      bulkUploadResponse.uploadedFile = uploadedFile;
      debugAndInfo("File upload completed successfully after processing", uploadedFile.path);
      returnResponse();
    }
  });

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

  function returnResponse() {
    const response: AwsFileUploadResponse = {response: bulkUploadResponse};
    if (bulkUploadError.error) {
      response.error = bulkUploadError.error;
    }
    res.json(response);
  }

  function logWithStatus(status: AuditStatus, ...argumentsData: any[]) {
    const debugData = map(argumentsData, item => isObject(item) ? JSON.stringify(item) : item).join(" ");
    debugLog(debugData);
    bulkUploadResponse.auditLog.push({status, message: debugData});
    if (status === "error") {
      bulkUploadError.error = debugData;
    }
  }

  function debugAndInfo(...argumentsData: any[]) {
    logWithStatus(AuditStatus.info, arguments);
  }

  function uploadedFileInfo(): UploadedFile {
    return first(req.files);
  }

}
