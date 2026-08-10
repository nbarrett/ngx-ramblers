import sharp from "sharp";
import {
  INSTAGRAM_MAX_ASPECT_RATIO,
  INSTAGRAM_MIN_ASPECT_RATIO
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { InstagramImageResult } from "./instagram-image.model";

const INSTAGRAM_IMAGE_SIZE = 1080;
const INSTAGRAM_JPEG_QUALITY = 90;

function instagramCropDimensions(width: number, height: number, aspectRatio: number): {width: number; height: number} {
  if (aspectRatio > INSTAGRAM_MAX_ASPECT_RATIO) {
    const targetWidth = Math.min(width, INSTAGRAM_IMAGE_SIZE);
    const targetHeight = Math.ceil(targetWidth / INSTAGRAM_MAX_ASPECT_RATIO);
    return targetHeight <= height
      ? {width: targetWidth, height: targetHeight}
      : {width: Math.floor(height * INSTAGRAM_MAX_ASPECT_RATIO), height};
  } else {
    const targetWidth = Math.min(width, INSTAGRAM_IMAGE_SIZE);
    return {
      width: targetWidth,
      height: Math.min(height, Math.ceil(targetWidth / INSTAGRAM_MIN_ASPECT_RATIO))
    };
  }
}

export async function prepareInstagramImage(input: Buffer): Promise<InstagramImageResult> {
  const oriented = await sharp(input).rotate().toBuffer({resolveWithObject: true});
  const aspectRatio = oriented.info.width / oriented.info.height;
  const transformRequired = aspectRatio < INSTAGRAM_MIN_ASPECT_RATIO || aspectRatio > INSTAGRAM_MAX_ASPECT_RATIO;
  let result: InstagramImageResult;
  if (transformRequired) {
    const dimensions = instagramCropDimensions(oriented.info.width, oriented.info.height, aspectRatio);
    const body = await sharp(oriented.data)
      .resize(dimensions.width, dimensions.height, {fit: "cover", position: sharp.strategy.attention})
      .jpeg({quality: INSTAGRAM_JPEG_QUALITY})
      .toBuffer();
    result = {body, transformed: true};
  } else {
    result = {body: input, transformed: false};
  }
  return result;
}
