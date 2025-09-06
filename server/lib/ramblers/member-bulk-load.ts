import * as childProcess from "child_process";
import parse from "csv-parse/sync";
import debug from "debug";
import * as fs from "fs";
import { find, first, isEmpty, isObject, trim } from "lodash";
import * as path from "path";
import * as xlsx from "xlsx";
import { UploadedFile } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import {
  MemberBulkLoadAudit,
  MemberBulkLoadAuditApiResponse,
  RamblersMember
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import * as aws from "../aws/aws-controllers";
import { envConfig } from "../env-config/env-config";
import { isAwsUploadErrorResponse } from "../aws/aws-utils";
import { momentNow } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";

const BULK_LOAD_SUFFIX = "MemberList.csv";
const NEW_MEMBER_SUFFIX = "new.csv";
const EXCEL_SUFFIX = ".xls";
const debugLog = debug(envConfig.logNamespace("ramblers:memberBulkLoad"));

export function uploadRamblersData(req, res) {
  const momentInstance = momentNow();
  const uploadSessionFolder = `memberAdmin/${momentInstance.format("YYYY-MM-DD-HH-mm-ss")}`;
  const uploadedFile = uploadedFileInfo();
  const bulkUploadResponse: MemberBulkLoadAudit = {members: [], files: {archive: null, data: null}, auditLog: []};
  const bulkUploadError = {error: undefined};

  debugAndInfo("Received uploaded member data file", uploadedFile.originalname, "containing", uploadedFile.size, "bytes");
  if (fileExtensionIs(".zip")) {
    extractZipFile(uploadedFile.path, uploadedFile.originalname, res);
  } else if (fileExtensionIs(".csv") && filenameValid()) {
    extractCsvToJson(uploadedFile.path, uploadedFile.originalname);
  } else if (isExcel()) {
    extractExcelDataToJson(uploadedFile.path, uploadedFile.originalname, res);
  } else {
    fs.unlink(uploadedFile.originalname, () => {
      debugAndError(`Only zip files or files that end with "${BULK_LOAD_SUFFIX}", ${EXCEL_SUFFIX} or "${NEW_MEMBER_SUFFIX}" are allowed, but you supplied ${uploadedFile.originalname}`);
      returnResponse();
    });
  }

  function returnResponse() {
    const response: MemberBulkLoadAuditApiResponse = {action: null, request: null, response: bulkUploadResponse};
    if (bulkUploadError.error) {
      response.error = bulkUploadError.error;
    }
    res.json(response);
  }

  function logWithStatus(status, logItems: any[]) {
    const debugData = logItems.map(item => isObject(item) ? JSON.stringify(item) : item).join(" ");
    debugLog(debugData);
    bulkUploadResponse.auditLog.push({status, message: debugData});
    if (status === "error") {
      bulkUploadError.error = debugData;
    }
  }

  function debugAndComplete(...logItems: any[]) {
    logWithStatus("complete", logItems);
  }

  function debugAndInfo(...logItems: any[]) {
    logWithStatus("info", logItems);
  }

  function debugAndError(...logItems: any[]) {
    logWithStatus("error", logItems);
  }

  function isExcel() {
    return uploadedFile.originalname.includes(EXCEL_SUFFIX);
  }

  function filenameValid() {
    return uploadedFile.originalname.endsWith(BULK_LOAD_SUFFIX) || uploadedFile.originalname.endsWith(NEW_MEMBER_SUFFIX) || isExcel();
  }

  function uploadedFileInfo(): UploadedFile {
    return first(req.files);
  }

  function fileExtensionIs(extension) {
    return path.extname(uploadedFileInfo().originalname).toLowerCase() === extension;
  }

  function extractZipFile(receivedZipFileName: string, userZipFileName: string, res) {
    aws.putObjectDirect(uploadSessionFolder, userZipFileName, receivedZipFileName).then(response => {
      if (isAwsUploadErrorResponse(response)) {
        return res.status(500).send(response);
      } else {
        debugAndInfo(response.information);
        bulkUploadResponse.files.archive = `${uploadSessionFolder}/${uploadedFile.originalname}`;
        const inflateToken = "inflating:";
        const unzipPath = "/tmp/memberData/";
        const zip = childProcess.spawn("unzip", ["-P", "J33ves33", "-o", "-d", unzipPath, receivedZipFileName]);
        let zipOutputLines = [];
        let zipErrorLines = [];

        const handleError = data => {
          zipErrorLines = zipErrorLines.concat(data.toString().trim().split("\n"));
          debugAndError(`Unzip of ${userZipFileName} ended unsuccessfully. Unzip process terminated with: ${zipErrorLines.join(", ")}`);
          returnResponse();
        };

        zip.stdout.on("data", data => {
          const logOutput = data.toString().trim().split("\n").filter(item => !isEmpty(item));
          if (logOutput.length > 0) {
            debugAndInfo(`Unzip output [${logOutput}]`);
            zipOutputLines = zipOutputLines.concat(logOutput);
          }
        });

        zip.on("error", handleError);

        zip.stderr.on("data", handleError);

        zip.on("exit", code => {
          if (code !== 0) {
            debugAndError(`Unzip of ${userZipFileName} ended unsuccessfully. Unzip process terminated with: ${zipErrorLines.join(", ")}`);
            returnResponse();
          } else {
            const extractedFiles = zipOutputLines
              .filter(file => file.includes(inflateToken))
              .map(file => file.replace(inflateToken, "").trim());
            debugAndInfo("Unzip process completed successfully after processing", receivedZipFileName, "and extracted",
              extractedFiles.length, "file(s):", extractedFiles.join(", "));
            if (extractedFiles.length === 0) {
              debugAndError(`No files could be unzipped from ${userZipFileName}`);
              returnResponse();
            } else {
              extractFromFile(extractedFiles, BULK_LOAD_SUFFIX, res).then(response => {
                if (response.error) {
                  debugAndError(response.error);
                  returnResponse();
                } else if (!response) {
                  extractFromFile(extractedFiles, NEW_MEMBER_SUFFIX, res).then(response => {
                    if (!response) {
                      debugAndError(`No bulk load or new member file could be found in zip ${userZipFileName}.${extractedFiles.length} ignored files were: ${extractedFiles.join(", ")}`);
                      returnResponse();
                    }
                  });
                }
              });
            }
          }
        });
      }
      }
    );
  }

  function extractExcelDataToJson(uploadedWorkbook, userFileName, res) {
    debugLog(`Reading members from ${uploadedWorkbook}`);
    bulkUploadResponse.files.data = `${uploadSessionFolder}/${userFileName}`;
    aws.putObjectDirect(uploadSessionFolder, userFileName, uploadedWorkbook)
      .then(response => {
        if (isAwsUploadErrorResponse(response)) {
          return response;
        } else {
          const workbook = xlsx.readFile(uploadedWorkbook);
          const ramblersSheet = first(workbook.SheetNames
            .filter(function (sheet) {
              debugLog("sheet", sheet);
              return sheet.includes("Full List");
            }));
          debugLog("Importing data from workbook sheet", ramblersSheet);
          const json = xlsx.utils.sheet_to_json(workbook.Sheets[ramblersSheet]);
          if (json.length > 0) {
            extractMemberDataFromArray(json, userFileName);
            return returnResponse();
          } else {
            debugAndError(`Excel workbook ${userFileName} did not contain a sheet called [${ramblersSheet}] or no data rows were found in it`);
            returnResponse();
          }
        }
      });
  }

  function membershipSecratariesInsightHubFormat(dataRow) {
    return dataRow["Mem No."];
  }

  function extractFromFile(extractedFiles, fileNameSuffix, res) {
    const memberDataFileName = find(extractedFiles, file => file.endsWith(fileNameSuffix));
    if (memberDataFileName) {
      debugAndInfo(memberDataFileName, "matched", fileNameSuffix);
      return aws.putObjectDirect(uploadSessionFolder, memberDataFileName, memberDataFileName)
        .then(response => {
          if (isAwsUploadErrorResponse(response)) {
            return response;
          } else {
            debugAndInfo(response.information);
            extractCsvToJson(memberDataFileName, path.basename(memberDataFileName));
            return true;
          }
        });
    } else {
      debugAndInfo("No files matched", fileNameSuffix);
      return Promise.resolve(false);
    }
  }

  function extractMemberDataFromArray(json: any[], userFileName) {
    let currentDataRow: any;
    try {
      const memberDataRows: RamblersMember[] = json.map(dataRow => {
        currentDataRow = dataRow;
        if (membershipSecratariesInsightHubFormat(dataRow)) {
          return {
            membershipExpiryDate: trim(dataRow["Expiry date"]),
            membershipNumber: trim(dataRow["Mem No."]),
            mobileNumber: trim(dataRow["Mobile Telephone"]),
            email: trim(dataRow["Email Address"]),
            firstName: trim(dataRow["Forenames"] || dataRow["Initials"]),
            lastName: trim(dataRow["Surname"] || dataRow["Last Name"]),
            postcode: trim(dataRow["Postcode"]),
            jointWith: trim(dataRow["Joint With"]),
            title: trim(dataRow["Title"]),
            type: trim(dataRow["Type"]),
            landlineTelephone: trim(dataRow["Landline Telephone"]),
            emailMarketingConsent: trim(dataRow["Email Marketing Consent"]),
            emailPermissionLastUpdated: trim(dataRow["Email Permission Last Updated"])
          };
        } else {
          debugAndError(`Loading of data from ${userFileName} failed processing data row ${JSON.stringify(currentDataRow)} due to membership record type not being recognised`);
        }
      })
        .filter(dataRow => dataRow?.membershipNumber);
      bulkUploadResponse.members = memberDataRows;
      debugAndComplete(`${pluraliseWithCount(memberDataRows.length, "member")} were extracted from ${userFileName}`);
    } catch (error) {
      debugAndError("Error attempting to extract data from", userFileName);
      debugAndError(`Error message:${error.message}`);
      debugAndError("Error stack:", error.stack);
      return debugAndError(`Loading of data from ${userFileName} failed processing data row ${JSON.stringify(currentDataRow)} due to unexpected error:${error}`);
    }
  }

  async function extractCsvToJson(localFileName: string, userFileName: string) {
    debugAndInfo("Extracting member data from", userFileName);
    bulkUploadResponse.files.data = `${uploadSessionFolder}/${userFileName}`;
    const content = fs.readFileSync(localFileName);
    try {
      parse.parse(content, {columns: true, delimiter: ",", escape: "\""}).map(data => {
        extractMemberDataFromArray(data, userFileName);
        returnResponse();
      });
    } catch (error) {
      debugAndError("Data could not be extracted from", localFileName, error);
      returnResponse();
    }
  }

}
