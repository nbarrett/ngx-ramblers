import { NextFunction, Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { queryKey } from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { WalksConfig } from "../../../projects/ngx-ramblers/src/app/models/walks-config.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ContentMetadata, ContentMetadataItem } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { contentMetadata } from "../mongo/models/content-metadata";
import * as transforms from "../mongo/controllers/transforms";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("photo-contribution-access"));
debugLog.enabled = true;

async function publicPhotoContributionAllowed(): Promise<boolean> {
  const walksConfig: WalksConfig = (await queryKey(ConfigKey.WALKS))?.value;
  return walksConfig?.walkPhotoContributionAccessLevel === AccessLevel.PUBLIC;
}

export async function requirePhotoContributionAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user) {
    next();
  } else if (await publicPhotoContributionAllowed()) {
    debugLog("allowing public photo contribution request to", req.originalUrl);
    next();
  } else {
    res.status(401).json({error: "Please log in"});
  }
}

export function restrictPublicUploadToAlbums(req: Request, res: Response, next: NextFunction): void {
  const rootFolder = req.query["root-folder"]?.toString() || "";
  if (req.user || rootFolder === RootFolder.carousels || rootFolder.startsWith(`${RootFolder.carousels}/`)) {
    next();
  } else {
    res.status(403).json({error: "Public uploads are limited to photo albums"});
  }
}

function publicDraftItem(item: ContentMetadataItem, uploadedAt: number): ContentMetadataItem {
  const {_id, ...rest} = item as ContentMetadataItem & {_id?: unknown};
  return {...rest, draft: true, uploadedBy: null, uploadedAt: item.uploadedAt || uploadedAt};
}

export async function restrictPublicMetadataUpdateToDraftAdditions(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user) {
    next();
  } else {
    const existing: ContentMetadata = await contentMetadata.findById(req.params.id).lean().then(doc => doc ? transforms.toObjectWithId(doc) as ContentMetadata : null);
    const requested: ContentMetadata = req.body;
    const existingImages = new Set((existing?.files || []).map(file => file.image).filter(Boolean));
    const additions = (requested?.files || []).filter(file => !!file?.image && !existingImages.has(file.image));
    const unidentified = additions.filter(file => !file.uploadedByEmail);
    if (!existing) {
      res.status(404).json({error: "Album not found"});
    } else if (existing.rootFolder !== RootFolder.carousels) {
      res.status(403).json({error: "Public contributions are limited to photo albums"});
    } else if (additions.length === 0) {
      res.status(403).json({error: "Public contributions may only add photos"});
    } else if (unidentified.length > 0) {
      res.status(400).json({error: "Each photo needs the contributor's email address"});
    } else {
      const uploadedAt = dateTimeNowAsValue();
      req.body = {...existing, files: [...additions.map(item => publicDraftItem(item, uploadedAt)), ...existing.files]};
      debugLog("public contribution adding", additions.length, "draft photos to", existing.name);
      next();
    }
  }
}
