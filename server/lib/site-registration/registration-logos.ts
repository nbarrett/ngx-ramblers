import debug from "debug";
import path from "path";
import { CopyObjectCommand, HeadObjectCommand, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";
import { kebabCase } from "es-toolkit/compat";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  RamblersDirectoryLogo, RamblersDirectoryLogoKind, StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { envConfig } from "../env-config/env-config";
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

function directoryNameVariants(name: string, trailing: RegExp): string[] {
  const trimmed = (name || "").trim();
  const shortened = trimmed.replace(trailing, "").trim();
  return [trimmed, shortened].filter((item, index, items) => item && items.indexOf(item) === index);
}

export function ramblersDirectoryLogoCandidates(groupName: string, areaName: string): RamblersDirectoryLogo[] {
  const groupNames = directoryNameVariants(groupName, /\s+group$/i);
  const areaNames = directoryNameVariants(areaName || groupName, /\s+area$/i);
  const names = [
    ...groupNames.map(name => ({kind: RamblersDirectoryLogoKind.GROUP_HORIZONTAL, name})),
    ...areaNames.map(name => ({kind: RamblersDirectoryLogoKind.AREA_HORIZONTAL, name})),
    ...groupNames.map(name => ({kind: RamblersDirectoryLogoKind.GROUP_VERTICAL, name})),
    ...areaNames.map(name => ({kind: RamblersDirectoryLogoKind.AREA_VERTICAL, name}))
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

export async function ingestRamblersDirectoryLogoFile(localPath: string): Promise<RamblersDirectoryLogo | null> {
  const parsed = parseRamblersDirectoryLogoFileName(path.basename(localPath));
  if (!parsed) {
    return null;
  } else {
    const {client, bucket} = platformS3();
    const body = await readFile(localPath);
    const contentType = parsed.awsFileName.endsWith(".png") ? "image/png" : "image/jpeg";
    await client.send(new PutObjectCommand({Bucket: bucket, Key: parsed.awsFileName, Body: body, ContentType: contentType}));
    return parsed;
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
