import {CopyObjectCommand, DeleteObjectCommand, S3} from "@aws-sdk/client-s3";
import debug from "debug";
import {NextFunction, Request, Response} from "express";
import {cloneDeep} from "es-toolkit/compat";
import {ApiAction} from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  ContentMetadataCopyImageRequest,
  ContentMetadataCopySourceContext,
  ContentMetadataItem,
  ImageTag
} from "../../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {nextTagKey} from "../../../../projects/ngx-ramblers/src/app/functions/tags";
import {RootFolder} from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import {generateAwsFileName} from "../../aws/aws-utils";
import {queryAWSConfig} from "../../aws/aws-controllers";
import {envConfig} from "../../env-config/env-config";
import {contentMetadata} from "../models/content-metadata";
import {pageContent} from "../models/page-content";
import {extendedGroupEvent} from "../models/extended-group-event";
import {albumImageTitle} from "../../ai/album-image-title";

const debugLog = debug(envConfig.logNamespace("content-metadata-copy"));

function encodedCopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split("/").map(segment => encodeURIComponent(segment)).join("/")}`;
}

export function mappedTags(sourceTags: ImageTag[], destinationTags: ImageTag[], sourceKeys: number[]): {tags: ImageTag[]; keys: number[]} {
  return (sourceKeys || []).reduce((result, sourceKey) => {
    const sourceTag = (sourceTags || []).find(tag => tag.key === sourceKey);
    const destinationTag = sourceTag
      ? result.tags.find(tag => tag.subject?.toLowerCase() === sourceTag.subject?.toLowerCase())
      : null;
    if (destinationTag) {
      return {...result, keys: [...result.keys, destinationTag.key]};
    } else if (sourceTag) {
      const key = nextTagKey(result.tags);
      const newTag = {...cloneDeep(sourceTag), key};
      return {tags: [...result.tags, newTag], keys: [...result.keys, key]};
    } else {
      return result;
    }
  }, {tags: [...(destinationTags || [])], keys: [] as number[]});
}

export function copiedImageMetadata(sourceItem: ContentMetadataItem, destinationImage: string, tags: number[], context: ContentMetadataCopySourceContext = {}): ContentMetadataItem {
  const sourceHasEventMetadata = !!sourceItem.eventId || (sourceItem.dateSource && sourceItem.dateSource !== "upload");
  return {
    date: sourceHasEventMetadata ? sourceItem.date : context.date || sourceItem.date,
    image: destinationImage,
    originalFileName: sourceItem.originalFileName,
    text: sourceItem.text || context.text,
    tags,
    youtubeId: sourceItem.youtubeId,
    cropperPosition: null,
    eventId: sourceItem.eventId || context.eventId,
    dateSource: sourceHasEventMetadata ? sourceItem.dateSource : context.dateSource || sourceItem.dateSource
  };
}

async function sourceContextFor(albumName: string): Promise<ContentMetadataCopySourceContext> {
  const sourcePage = await pageContent.findOne({"rows.carousel.name": albumName});
  const sourceCarousel = sourcePage?.rows?.find(row => row.carousel?.name === albumName)?.carousel;
  const sourceEventId = sourceCarousel?.eventId;
  const linkedEvent = sourceEventId
    ? await extendedGroupEvent.findOne({"groupEvent.id": String(sourceEventId)})
    : null;
  const generatedTitle = linkedEvent
    ? await albumImageTitle(linkedEvent, sourceCarousel?.subtitle)
    : sourceCarousel?.subtitle;
  return {
    date: sourceCarousel?.eventDate,
    dateSource: sourceCarousel?.eventType,
    eventId: linkedEvent?.id || sourceEventId,
    text: generatedTitle
  };
}

export async function copyImageToAlbum(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = req.body as ContentMetadataCopyImageRequest;
    const sourceAlbum = await contentMetadata.findOne({name: request.sourceAlbumName, rootFolder: RootFolder.carousels});
    const destinationAlbum = await contentMetadata.findOne({name: request.destinationAlbumName, rootFolder: RootFolder.carousels});
    const sourceItem = sourceAlbum?.files?.find(item => item.image === request.sourceImage);
    if (!sourceAlbum || !destinationAlbum || !sourceItem?.image) {
      res.status(404).json({error: "The source image or destination album could not be found"});
    } else if (sourceAlbum.id === destinationAlbum.id) {
      res.status(400).json({error: "Choose a different destination album"});
    } else {
      const config = queryAWSConfig();
      const client = new S3(config);
      const sourceKey = `${sourceAlbum.rootFolder}/${sourceAlbum.name}/${sourceItem.image}`;
      const destinationImage = generateAwsFileName(sourceItem.image, false);
      const destinationKey = `${destinationAlbum.rootFolder}/${destinationAlbum.name}/${destinationImage}`;
      await client.send(new CopyObjectCommand({
        Bucket: config.bucket,
        CopySource: encodedCopySource(config.bucket, sourceKey),
        Key: destinationKey
      }));
      try {
        const tagMapping = mappedTags(sourceAlbum.imageTags, destinationAlbum.imageTags, sourceItem.tags);
        const sourceContext = await sourceContextFor(sourceAlbum.name);
        const copiedItem = copiedImageMetadata(sourceItem, destinationImage, tagMapping.keys, sourceContext);
      destinationAlbum.imageTags = tagMapping.tags;
      destinationAlbum.files.unshift(copiedItem);
        const savedDestination = await destinationAlbum.save();
        debugLog("copied", sourceKey, "to", destinationKey);
        res.status(200).json({request, action: ApiAction.UPDATE, response: savedDestination});
      } catch (error) {
        await client.send(new DeleteObjectCommand({Bucket: config.bucket, Key: destinationKey}));
        throw error;
      }
    }
  } catch (error) {
    debugLog("image copy failed", error);
    next(error);
  }
}
