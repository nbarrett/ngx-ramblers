import * as AWS from "@aws-sdk/client-s3";
import { GetObjectCommand, GetObjectRequest, S3 } from "@aws-sdk/client-s3";
import { ListObjectsCommandOutput } from "@aws-sdk/client-s3/dist-types/commands/ListObjectsCommand";
import * as crypto from "crypto";
import debug from "debug";
import { Request, Response } from "express";
import * as fs from "fs";
import * as https from "https";
import { omit } from "lodash";
import moment from "moment-timezone";
import * as path from "path";
import { S3Metadata } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { envConfig } from "../env-config/env-config";
import { AwsInfo, AwsUploadErrorResponse } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";

const logObject = false;
const s3Config = {
  accessKeyId: envConfig.aws.accessKeyId,
  secretAccessKey: envConfig.aws.secretAccessKey,
  region: envConfig.aws.region
};
const s3: S3 = new AWS.S3(s3Config);
const debugLog = debug(envConfig.logNamespace("aws"));
debugLog.enabled = true;
debugLog("configured with", s3Config, "Proxying S3 requests to", envConfig.aws.uploadUrl, "http.globalAgent.maxSockets:", https.globalAgent.maxSockets);

export function listObjects(req: Request, res: Response) {
  const bucketParams = {
    Bucket: envConfig.aws.bucket,
    Prefix: req.params.prefix,
    MaxKeys: 20000
  };
  debugLog("listObjects:bucketParams:", bucketParams);
  s3.listObjects(bucketParams)
    .then((data: ListObjectsCommandOutput) => {
      const response: S3Metadata[] = data.Contents?.map(item => ({
        key: item.Key,
        lastModified: moment(item.LastModified).tz("Europe/London").valueOf(),
        size: item.Size
      })) || [];
      debugLog("returned data for:bucketParams:", bucketParams, "returned:", response.length, "items");
      res.status(200).send(response);
    })
    .catch(err => {
      debugLog("listObjects:error occurred:bucketParams:", bucketParams, "error:", err);
      res.status(500).send(err);
    });
}

export async function getObject(req: Request, res: Response) {
  const options = optionsFrom(req);
  const getObjectCommand = new GetObjectCommand(options);
  try {
    debugLog("getting object command using options", options);
    const s3Item: any = await s3.send(getObjectCommand);
    if (logObject) {
      debugLog("got object", s3Item);
    }
    res.writeHead(200, {"Content-Type": contentTypeFrom(options.Key)});
    s3Item.Body.pipe(res);
    debugLog("returned object command using options", options);
  } catch (err) {
    debugLog("failed getting object command using options", options, err);
    res.status(500).send(err);
  }
}

export function getConfig(req: Request, res: Response) {
  return res.send(envConfig.aws);
}

export function listBuckets(req: Request, res: Response) {
  s3.listBuckets((err, data) => {
    if (!err) {
      return res.status(200).send(data);
    } else {
      return res.status(500).send(err);
    }
  });
}

export function putObjectDirect(rootFolder: string, fileName: string, localFileName: string): Promise<AwsInfo | AwsUploadErrorResponse> {
  debugLog("configured with", s3Config);
  const bucket = envConfig.aws.bucket;
  const objectKey = `${rootFolder}/${path.basename(fileName)}`;
  const data = fs.readFileSync(localFileName);
  const params = {
    Bucket: bucket,
    Key: objectKey,
    Body: data,
    ACL: "public-read",
    ContentType: contentTypeFrom(objectKey)
  };
  debugLog(`Saving file to ${bucket}/${objectKey} using params:`, JSON.stringify(omit(params, "Body")));
  return s3.putObject(params)
    .then(data => {
      const information = `Successfully uploaded file to ${bucket}/${objectKey}`;
      debugLog(information, "->", data);
      return ({responseData: data, information});
    })
    .catch(error => {
      const errorMessage = `Failed to upload object to ${bucket}/${objectKey}`;
      debugLog(errorMessage, "->", error);
      return ({responseData: error, error: errorMessage});
    });
}

export function urlToFile(req: Request, res: Response) {
  const remoteUrl = req.query.url as string;
  debugLog("downloading remote image from", remoteUrl);
  https.get(remoteUrl, serverResponse => {
    serverResponse.pipe(res);
  }).on("error", e => {
    debugLog("Got error", e.message, "on s3 request", remoteUrl);
  });
}

function expiryTime() {
  const _date = new Date();
  const expiryDate = `${_date.getFullYear()}-${_date.getMonth() + 1}-${_date.getDate() + 1}T${_date.getHours() + 3}:00:00.000Z`;
  debugLog("expiryDate:", expiryDate);
  return expiryDate;
}

function extensionFrom(key: string): string {
  const extension = path.extname(key).toLowerCase();
  return extension.length <= 5 ? extension : ".jpeg";
}

function contentTypeFrom(fileName: string): string {
  const extension = extensionFrom(fileName);
  if ([".jpg", ".jpeg"].includes(extension)) {
    return "image/jpeg";
  } else if ([".png", ".x-png"].includes(extension)) {
    return "image/png";
  } else if ([".pdf"].includes(extension)) {
    return "application/pdf";
  } else if ([".doc", ".docx", ".dot"].includes(extension)) {
    return "application/msword";
  } else {
    return "image/jpeg";
  }
}

function optionsFrom(req: Request): GetObjectRequest {
  const key = `${req.params.bucket}${req.params[0]}`;
  return {Bucket: envConfig.aws.bucket, Key: key};
}

async function getObjectAsBase64(req: Request, res: Response) {
  const options: GetObjectRequest = optionsFrom(req);
  debugLog("getting object", options);
  try {
    const response: any = await s3.getObject(options);
    debugLog("received response Body:", response.Body);
    const text = await response.Body.text();
    const contentType = contentTypeFrom(options.Key);
    const src = `data:${contentType};base64,${text}`;
    debugLog("src", src);
    res.status(200).send(src);
  } catch (error) {
    debugLog("Caught error", error.message, "on s3 request", options.Key);
    res.status(500).send(error);
  }
}

export async function get(req: Request, res: Response) {
  const options = optionsFrom(req);
  const response: any = await s3.getObject(options);
  debugLog("received response Body:", response.Body);
  const imageBytes: any = await response.Body.arrayBuffer();
  const contentType = contentTypeFrom(options.Key);
  const blob = new Blob([imageBytes], {type: contentType});
  const imageUrl = URL.createObjectURL(blob);
  debugLog("blob", blob, "imageUrl:", imageUrl);
  res.status(200).send(imageUrl);
}

function s3Policy(req: Request, res: Response) {
  debugLog("req.query.mimeType", req.query.mimeType, "req.query.objectKey", req.query.objectKey);
  const s3Policy = {
    "expiration": expiryTime(),
    "conditions": [
      ["starts-with", "$key", `${req.query.objectKey ? req.query.objectKey : ""}/`],
      {"bucket": envConfig.aws.bucket},
      {"acl": "public-read"},
      ["starts-with", "$Content-Type", req.query.mimeType ? req.query.mimeType : ""],
      {"success_action_status": "201"},
    ],
  };

  // stringify and encode the policy
  const stringPolicy = JSON.stringify(s3Policy);
  const base64Policy = new Buffer(stringPolicy, "utf-8").toString("base64");

  debugLog("s3Policy", s3Policy);
  debugLog("config.aws.secretAccessKey", envConfig.aws.secretAccessKey);

  // sign the base64 encoded policy
  const signature = crypto.createHmac("sha1", envConfig.aws.secretAccessKey)
    .update(new Buffer(base64Policy, "utf-8")).digest("base64");

  return res.status(200).send({
    s3Policy: base64Policy,
    s3Signature: signature,
    AWSAccessKeyId: envConfig.aws.accessKeyId,
  });
}
