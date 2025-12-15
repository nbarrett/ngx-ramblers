import * as AWS from "@aws-sdk/client-s3";
import { GetObjectCommand, GetObjectRequest, S3 } from "@aws-sdk/client-s3";
import { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3/dist-types/commands/ListObjectsV2Command";
import { ListObjectsCommandOutput } from "@aws-sdk/client-s3/dist-types/commands/ListObjectsCommand";
import * as crypto from "crypto";
import debug from "debug";
import { Request, Response } from "express";
import * as fs from "fs";
import * as https from "https";
import { omit } from "es-toolkit/compat";
import * as path from "path";
import {
  S3Metadata,
  S3MetadataApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { envConfig } from "../env-config/env-config";
import {
  AWSConfig,
  AwsInfo,
  AwsUploadErrorResponse
} from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { contentTypeFrom } from "./aws-utils";
import { dateTimeFromJsDate, dateTimeNow } from "../shared/dates";

const logObject = false;
const s3Config: AWSConfig = {
  accessKeyId: envConfig.aws.accessKeyId,
  secretAccessKey: envConfig.aws.secretAccessKey,
  region: envConfig.aws.region,
  bucket: envConfig.aws.bucket
};
const s3: S3 = new AWS.S3(s3Config);
const debugLog = debug(envConfig.logNamespace("aws"));
debugLog.enabled = true;
debugLog("configured with", s3Config, "Proxying S3 requests to", envConfig.aws.uploadUrl, "http.globalAgent.maxSockets:", https.globalAgent.maxSockets);

export function queryAWSConfig(): AWSConfig {
  return s3Config;
}

export function listObjects(req: Request, res: Response) {
  const bucketParams = {
    Bucket: s3Config.bucket,
    Prefix: req.query.prefix.toString(),
    MaxKeys: 20000
  };
  debugLog("listObjects:request:bucketParams:", bucketParams);
  s3.listObjects(bucketParams)
    .then((data: ListObjectsCommandOutput) => {
      const response: S3Metadata[] = data.Contents?.map(item => ({
        key: item.Key,
        lastModified: dateTimeFromJsDate(item.LastModified).toMillis(),
        size: item.Size
      })) || [];
      debugLog("listObjects:response data for:bucketParams:", bucketParams, "returned:", response.length, "items");
      const apiResponse: S3MetadataApiResponse = {request: bucketParams, response, action: ApiAction.QUERY};
      res.status(200).send(apiResponse);
    })
    .catch(err => {
      debugLog("listObjects:error occurred:bucketParams:", bucketParams, "error:", err);
      res.status(500).send(err);
    });
}

export async function listPrefixes(req: Request, res: Response) {
  const bucketParams = {
    Bucket: s3Config.bucket,
    Prefix: (req.query.prefix || "").toString(),
    Delimiter: "/",
    MaxKeys: 20000
  };
  debugLog("listPrefixes:request:bucketParams:", bucketParams);
  try {
    const data: ListObjectsV2CommandOutput = await s3.listObjectsV2(bucketParams);
    const prefixes = (data.CommonPrefixes || []).map(p => p.Prefix);
    res.status(200).send({ request: bucketParams, response: prefixes });
  } catch (err) {
    debugLog("listPrefixes:error occurred:bucketParams:", bucketParams, "error:", err);
    res.status(500).send(err);
  }
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
    if (err.name === "NoSuchKey") {
      res.status(404).send({ error: "Object not found", key: options.Key });
    } else {
    res.status(500).send(err);
  }
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
  const bucket = s3Config.bucket;
  const objectKey = `${rootFolder}/${path.basename(fileName)}`;
  const fileStream = fs.createReadStream(localFileName);
  const stats = fs.statSync(localFileName);
  const fileSizeInBytes = stats.size;
  const params = {
    Bucket: bucket,
    Key: objectKey,
    Body: fileStream,
    ContentType: contentTypeFrom(objectKey)
  };
  debugLog(`Saving file to ${bucket}/${objectKey}, size: ${fileSizeInBytes} bytes, using params:`, JSON.stringify(omit(params, "Body")));
  return s3.putObject(params)
    .then(data => {
      const information = `Successfully uploaded file to ${bucket}/${objectKey} (${fileSizeInBytes} bytes)`;
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
  const now = dateTimeNow();
  const expiry = now.plus({ days: 1, hours: 3 }).toUTC().toISO();
  debugLog("expiryDate:", expiry);
  return expiry;
}

function optionsFrom(req: Request): GetObjectRequest {
  const key = `${req.params.bucket}${req.params[0]}`;
  return {Bucket: s3Config.bucket, Key: key};
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
      {"bucket": s3Config.bucket},
      {"acl": "public-read"},
      ["starts-with", "$Content-Type", req.query.mimeType ? req.query.mimeType : ""],
      {"success_action_status": "201"},
    ],
  };

  const stringPolicy = JSON.stringify(s3Policy);
  const base64Policy = Buffer.from(stringPolicy, "utf-8").toString("base64");

  debugLog("s3Policy", s3Policy);
  debugLog("config.aws.secretAccessKey", envConfig.aws.secretAccessKey);

  const signature = crypto.createHmac("sha1", envConfig.aws.secretAccessKey)
    .update(base64Policy, "utf-8").digest("base64");

  return res.status(200).send({
    s3Policy: base64Policy,
    s3Signature: signature,
    AWSAccessKeyId: envConfig.aws.accessKeyId,
  });
}
