import debug from "debug";
import { readdirSync } from "fs";
import path from "path";
import { CopyObjectCommand, HeadObjectCommand, S3 } from "@aws-sdk/client-s3";
import { kebabCase } from "es-toolkit/compat";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  RamblersDirectoryLogo, RamblersDirectoryLogoKind, StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { envConfig } from "../env-config/env-config";
import { putObjectDirect } from "../aws/aws-controllers";
import { isAwsUploadErrorResponse } from "../aws/aws-utils";
import { connectToEnvironmentMongo, loadEnvironmentContext } from "../environment-setup/environment-context";

const debugLog = debug(envConfig.logNamespace("site-registration:logos"));

const FILE_KIND_PREFIXES: {kind: RamblersDirectoryLogoKind; prefix: string}[] = [
  {kind: RamblersDirectoryLogoKind.GROUP_HORIZONTAL, prefix: "Ramblers Group Logos Horizontal RGB "},
  {kind: RamblersDirectoryLogoKind.GROUP_HORIZONTAL, prefix: "Ramblers Group Logo Horizontal RGB "},
  {kind: RamblersDirectoryLogoKind.GROUP_VERTICAL, prefix: "Ramblers Group Logos Vertical RGB "},
  {kind: RamblersDirectoryLogoKind.GROUP_VERTICAL, prefix: "Ramblers Group Logo Vertical RGB "},
  {kind: RamblersDirectoryLogoKind.AREA_HORIZONTAL, prefix: "Ramblers Area Logos Horizontal RGB "},
  {kind: RamblersDirectoryLogoKind.AREA_VERTICAL, prefix: "Ramblers Area Logos Vertical RGB "}
];

export function ramblersDirectoryLogoSlug(name: string): string {
  return kebabCase((name || "").trim().replace(/&/g, "and").replace(/\s+/g, " "));
}

export function parseRamblersDirectoryLogoFileName(fileName: string): RamblersDirectoryLogo | null {
  const parsed = path.parse(fileName);
  const prefix = FILE_KIND_PREFIXES.find(item => parsed.name.startsWith(item.prefix));
  if (!prefix) {
    return null;
  } else {
    const displayName = parsed.name.slice(prefix.prefix.length).trim();
    const slug = ramblersDirectoryLogoSlug(displayName);
    const extension = parsed.ext.toLowerCase() || ".jpg";
    return slug ? {
      kind: prefix.kind,
      displayName,
      slug,
      originalFileName: fileName,
      awsFileName: `${RootFolder.logos}/${prefix.kind}-${slug}${extension}`
    } : null;
  }
}

export function ramblersDirectoryLogoCandidates(groupName: string, areaName: string): RamblersDirectoryLogo[] {
  const groupNames = [groupName, (groupName || "").replace(/\s+group$/i, "").trim()].filter((name, index, names) => name && names.indexOf(name) === index);
  const names = [
    ...groupNames.map(name => ({kind: RamblersDirectoryLogoKind.GROUP_HORIZONTAL, name})),
    {kind: RamblersDirectoryLogoKind.AREA_HORIZONTAL, name: areaName},
    ...groupNames.map(name => ({kind: RamblersDirectoryLogoKind.GROUP_VERTICAL, name})),
    {kind: RamblersDirectoryLogoKind.AREA_VERTICAL, name: areaName}
  ];
  const extensions = [".jpg", ".png"];
  return names.flatMap(item => {
    const slug = ramblersDirectoryLogoSlug(item.name);
    return slug ? extensions.map(extension => ({
      kind: item.kind,
      displayName: (item.name || "").trim(),
      slug,
      originalFileName: `${item.kind}-${slug}${extension}`,
      awsFileName: `${RootFolder.logos}/${item.kind}-${slug}${extension}`
    })) : [];
  });
}

function platformS3(): {client: S3; bucket: string} {
  const aws = envConfig.aws();
  return {
    bucket: aws.bucket,
    client: new S3({
      region: aws.region,
      credentials: {accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey}
    })
  };
}

async function objectExists(client: S3, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({Bucket: bucket, Key: key}));
    return true;
  } catch (error) {
    debugLog("head %s/%s: %s", bucket, key, error.message);
    return false;
  }
}

export async function findRamblersDirectoryLogo(groupName: string, areaName: string): Promise<RamblersDirectoryLogo | null> {
  const {client, bucket} = platformS3();
  const candidates = ramblersDirectoryLogoCandidates(groupName, areaName);
  const matches = await Promise.all(candidates.map(async candidate => ({
    candidate,
    present: await objectExists(client, bucket, candidate.awsFileName)
  })));
  return matches.find(item => item.present)?.candidate || null;
}

export async function uploadRamblersDirectoryLogos(sourceDirectory: string): Promise<{uploaded: number; skipped: number; unrecognised: number}> {
  const {client, bucket} = platformS3();
  const progress = {uploaded: 0, skipped: 0, unrecognised: 0};
  const files = readdirSync(sourceDirectory);
  const batchSize = 8;
  const batches = files.reduce((groups: string[][], fileName, index) => {
    const group = groups[Math.floor(index / batchSize)] || [];
    if (group.length === 0) {
      groups.push(group);
    }
    group.push(fileName);
    return groups;
  }, []);
  await batches.reduce(async (previous, batch) => {
    await previous;
    await Promise.all(batch.map(async fileName => {
      const parsed = parseRamblersDirectoryLogoFileName(fileName);
      if (!parsed) {
        progress.unrecognised += 1;
      } else if (await objectExists(client, bucket, parsed.awsFileName)) {
        progress.skipped += 1;
      } else {
        const response = await putObjectDirect(RootFolder.logos, path.basename(parsed.awsFileName), path.join(sourceDirectory, fileName));
        if (isAwsUploadErrorResponse(response)) {
          throw new Error(response.error);
        } else {
          progress.uploaded += 1;
        }
      }
    }));
  }, Promise.resolve());
  debugLog("upload complete", progress, "bucket", bucket);
  return progress;
}

export async function applyRamblersDirectoryLogo(registration: StoredSiteRegistration, areaName: string): Promise<RamblersDirectoryLogo | null> {
  const chosen = await findRamblersDirectoryLogo(registration.group?.name, areaName);
  if (!chosen) {
    return null;
  } else {
    const context = await loadEnvironmentContext(registration.environmentName);
    const {client, bucket} = platformS3();
    const targetBucket = context.envConfigData.aws.bucket;
    if (targetBucket !== bucket) {
      await client.send(new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `${bucket}/${chosen.awsFileName}`,
        Key: chosen.awsFileName
      }));
    }
    const connection = await connectToEnvironmentMongo(context.envConfigData);
    try {
      const image = {padding: 0, width: 300, originalFileName: chosen.originalFileName, awsFileName: chosen.awsFileName};
      const system = await connection.db.collection("config").findOne({key: ConfigKey.SYSTEM});
      const existing = (system?.value?.logos?.images || []).filter(item => item?.awsFileName && item.awsFileName !== chosen.awsFileName);
      await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {
        "value.logos.images": [image, ...existing],
        "value.header.selectedLogo": chosen.originalFileName
      }});
    } finally {
      await connection.client.close();
    }
    return chosen;
  }
}
