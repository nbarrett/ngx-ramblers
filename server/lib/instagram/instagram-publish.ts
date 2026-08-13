import debug from "debug";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { Instagram } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  GraphApiMethod,
  INSTAGRAM_MAX_CAROUSEL_IMAGES,
  INSTAGRAM_MIN_CAROUSEL_IMAGES,
  ResolvedAlbumImage,
  SocialConnectionStatus,
  SocialNetwork,
  SocialProgressCallback,
  SocialPublishProgress,
  SocialPublishResult
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { delay, graphApiRequest } from "../social/graph-api";
import { prepareInstagramAlbumImages } from "./instagram-image";

const debugLog = debug(envConfig.logNamespace("instagram:publish"));
debugLog.enabled = true;

const CONTAINER_POLL_ATTEMPTS = 40;
const CONTAINER_POLL_INTERVAL_MILLIS = 3000;
const READY_STATUS_CODES = ["FINISHED", "PUBLISHED"];
const FAILED_STATUS_CODES = ["ERROR", "EXPIRED"];

function containerStatusLabel(status: any): string {
  const code = isString(status?.status_code) ? status.status_code : "";
  const message = isString(status?.status) ? status.status : "";
  return [code, message].filter(Boolean).join(": ") || JSON.stringify(status || {});
}

function containerIsReady(status: any): boolean {
  const code = (status?.status_code || "").toString().toUpperCase();
  const message = (status?.status || "").toString().toLowerCase();
  return READY_STATUS_CODES.includes(code)
    || message.startsWith("finished")
    || message.includes("ready to be published")
    || message.includes("has been published");
}

function containerHasFailed(status: any): boolean {
  const code = (status?.status_code || "").toString().toUpperCase();
  const message = (status?.status || "").toString().toLowerCase();
  return FAILED_STATUS_CODES.includes(code)
    || message.startsWith("error")
    || message.startsWith("expired");
}

function reportProgress(onProgress: SocialProgressCallback | null, progress: SocialPublishProgress): void {
  if (onProgress) {
    onProgress(progress);
  }
}

async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  onProgress: SocialProgressCallback | null,
  progressContext: SocialPublishProgress
): Promise<void> {
  const progress = {attempt: 0, lastStatus: "unknown"};
  const check = async (): Promise<void> => {
    const status = await graphApiRequest({
      method: GraphApiMethod.GET,
      path: `/${containerId}`,
      params: {fields: "status_code,status", access_token: accessToken},
      debug: debugLog
    });
    progress.lastStatus = containerStatusLabel(status);
    debugLog("container status:", containerId, "attempt:", progress.attempt + 1, "status:", progress.lastStatus);
    if (!containerIsReady(status)) {
      if (containerHasFailed(status)) {
        throw new Error(`Instagram media container failed (${progress.lastStatus})`);
      } else if (progress.attempt + 1 >= CONTAINER_POLL_ATTEMPTS) {
        throw new Error(`Instagram media container not ready after ${CONTAINER_POLL_ATTEMPTS} checks (last status ${progress.lastStatus})`);
      } else {
        progress.attempt = progress.attempt + 1;
        reportProgress(onProgress, {
          ...progressContext,
          message: `${progressContext.message} (waiting for Instagram, check ${progress.attempt} of ${CONTAINER_POLL_ATTEMPTS})`
        });
        await delay(CONTAINER_POLL_INTERVAL_MILLIS);
        await check();
      }
    }
  };
  await check();
}

export async function instagramConnectionStatus(instagram: Instagram, accessToken: string): Promise<SocialConnectionStatus> {
  let status: SocialConnectionStatus;
  if (!instagram?.igUserId || !accessToken) {
    status = {network: SocialNetwork.INSTAGRAM, connected: false, error: "Connect a Facebook Page with a linked Instagram account first"};
  } else {
    try {
      const account = await graphApiRequest({
        method: GraphApiMethod.GET,
        path: `/${instagram.igUserId}`,
        params: {fields: "username", access_token: accessToken},
        debug: debugLog
      });
      status = {network: SocialNetwork.INSTAGRAM, connected: true, name: account.username ? `@${account.username}` : undefined};
    } catch (error) {
      debugLog("connection status failed:", error);
      status = {network: SocialNetwork.INSTAGRAM, connected: false, error: error?.message || String(error)};
    }
  }
  return status;
}

function assertInstagramConfigured(instagram: Instagram, accessToken: string): void {
  if (!instagram?.publishingEnabled) {
    throw new Error("Instagram publishing is disabled in System Settings");
  } else if (!instagram?.igUserId || !accessToken) {
    throw new Error("Instagram publishing is not configured: connect a Facebook Page with a linked Instagram account");
  }
}

export async function publishSingleImageToInstagram(
  instagram: Instagram,
  accessToken: string,
  images: ResolvedAlbumImage[],
  caption: string,
  onProgress: SocialProgressCallback = null
): Promise<SocialPublishResult> {
  assertInstagramConfigured(instagram, accessToken);
  if (images.length === 0) {
    throw new Error("Instagram needs an image to post - add one to this event first");
  }
  const preparedImages = await prepareInstagramAlbumImages(images.slice(0, 1));
  const igUserId = instagram.igUserId;
  const totalSteps = 3;
  debugLog("single image publish starting: url:", preparedImages[0]?.url);
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "upload-image",
    message: "Uploading the image to Instagram",
    completed: 0,
    total: totalSteps,
    percent: 0
  });
  const container = await graphApiRequest({
    method: GraphApiMethod.POST,
    path: `/${igUserId}/media`,
    params: {image_url: preparedImages[0].url, caption, access_token: accessToken},
    debug: debugLog
  });
  if (!container?.id) {
    throw new Error("Instagram did not return a media container id");
  }
  await waitForContainerReady(container.id, accessToken, onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "process-image",
    message: "Waiting for Instagram to process the image",
    completed: 1,
    total: totalSteps,
    percent: Math.round((1 / totalSteps) * 100)
  });
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "publish",
    message: "Publishing to Instagram",
    completed: 2,
    total: totalSteps,
    percent: Math.round((2 / totalSteps) * 100)
  });
  const published = await graphApiRequest({
    method: GraphApiMethod.POST,
    path: `/${igUserId}/media_publish`,
    params: {creation_id: container.id, access_token: accessToken},
    debug: debugLog
  });
  const permalinkResponse = await graphApiRequest({
    method: GraphApiMethod.GET,
    path: `/${published.id}`,
    params: {fields: "permalink", access_token: accessToken},
    debug: debugLog
  }).catch(error => {
    debugLog("permalink lookup failed:", error);
    return null;
  });
  debugLog("single image publish complete: postId:", published.id);
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "complete",
    message: "Instagram publish complete",
    completed: totalSteps,
    total: totalSteps,
    percent: 100
  });
  return {
    network: SocialNetwork.INSTAGRAM,
    success: true,
    postId: published.id,
    permalink: permalinkResponse?.permalink,
    imageCount: 1
  };
}

export async function publishEventToInstagram(
  instagram: Instagram,
  accessToken: string,
  images: ResolvedAlbumImage[],
  caption: string,
  onProgress: SocialProgressCallback = null
): Promise<SocialPublishResult> {
  return images.length >= INSTAGRAM_MIN_CAROUSEL_IMAGES
    ? publishAlbumToInstagram(instagram, accessToken, images, caption, onProgress)
    : publishSingleImageToInstagram(instagram, accessToken, images, caption, onProgress);
}

export async function publishAlbumToInstagram(
  instagram: Instagram,
  accessToken: string,
  images: ResolvedAlbumImage[],
  caption: string,
  onProgress: SocialProgressCallback = null
): Promise<SocialPublishResult> {
  if (!instagram?.publishingEnabled) {
    throw new Error("Instagram publishing is disabled in System Settings");
  }
  if (!instagram?.igUserId || !accessToken) {
    throw new Error("Instagram publishing is not configured: connect a Facebook Page with a linked Instagram account");
  }
  if (images.length < INSTAGRAM_MIN_CAROUSEL_IMAGES || images.length > INSTAGRAM_MAX_CAROUSEL_IMAGES) {
    throw new Error(`Instagram carousels need between ${INSTAGRAM_MIN_CAROUSEL_IMAGES} and ${INSTAGRAM_MAX_CAROUSEL_IMAGES} images (${images.length} selected)`);
  }
  const preparedImages = await prepareInstagramAlbumImages(images);
  const igUserId = instagram.igUserId;
  const children: string[] = [];
  const totalSteps = preparedImages.length + 2;
  debugLog("publish starting: imageCount:", preparedImages.length, "urls:", preparedImages.map(image => image.url));
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "prepare",
    message: `Preparing ${preparedImages.length} Instagram images`,
    completed: 0,
    total: totalSteps,
    percent: 0
  });
  for (const image of preparedImages) {
    const imageIndex = children.length + 1;
    reportProgress(onProgress, {
      network: SocialNetwork.INSTAGRAM,
      phase: "upload-image",
      message: `Uploading image ${imageIndex} of ${preparedImages.length} to Instagram`,
      completed: children.length,
      total: totalSteps,
      percent: Math.round((children.length / totalSteps) * 100)
    });
    debugLog("creating child container for:", image.image, "url:", image.url);
    const container = await graphApiRequest({
      method: GraphApiMethod.POST,
      path: `/${igUserId}/media`,
      params: {
        image_url: image.url,
        is_carousel_item: "true",
        access_token: accessToken
      },
      debug: debugLog
    });
    if (!container?.id) {
      throw new Error(`Instagram did not return a container id for image ${image.image}`);
    }
    debugLog("waiting for child container:", container.id, "image:", image.image);
    await waitForContainerReady(container.id, accessToken, onProgress, {
      network: SocialNetwork.INSTAGRAM,
      phase: "process-image",
      message: `Waiting for Instagram to process image ${imageIndex} of ${preparedImages.length}`,
      completed: children.length,
      total: totalSteps,
      percent: Math.round((children.length / totalSteps) * 100)
    });
    children.push(container.id);
    reportProgress(onProgress, {
      network: SocialNetwork.INSTAGRAM,
      phase: "image-ready",
      message: `Image ${imageIndex} of ${preparedImages.length} ready`,
      completed: children.length,
      total: totalSteps,
      percent: Math.round((children.length / totalSteps) * 100)
    });
  }
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "create-carousel",
    message: "Creating Instagram carousel",
    completed: preparedImages.length,
    total: totalSteps,
    percent: Math.round((preparedImages.length / totalSteps) * 100)
  });
  debugLog("creating carousel parent: childCount:", children.length);
  const carousel = await graphApiRequest({
    method: GraphApiMethod.POST,
    path: `/${igUserId}/media`,
    params: {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: accessToken
    },
    debug: debugLog
  });
  if (!carousel?.id) {
    throw new Error("Instagram did not return a carousel container id");
  }
  debugLog("waiting for carousel container:", carousel.id);
  await waitForContainerReady(carousel.id, accessToken, onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "process-carousel",
    message: "Waiting for Instagram to process the carousel",
    completed: preparedImages.length + 1,
    total: totalSteps,
    percent: Math.round(((preparedImages.length + 1) / totalSteps) * 100)
  });
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "publish",
    message: "Publishing Instagram carousel",
    completed: preparedImages.length + 1,
    total: totalSteps,
    percent: Math.round(((preparedImages.length + 1) / totalSteps) * 100)
  });
  debugLog("publishing carousel:", carousel.id);
  const published = await graphApiRequest({
    method: GraphApiMethod.POST,
    path: `/${igUserId}/media_publish`,
    params: {creation_id: carousel.id, access_token: accessToken},
    debug: debugLog
  });
  const permalinkResponse = await graphApiRequest({
    method: GraphApiMethod.GET,
    path: `/${published.id}`,
    params: {fields: "permalink", access_token: accessToken},
    debug: debugLog
  }).catch(error => {
    debugLog("permalink lookup failed:", error);
    return null;
  });
  debugLog("publish complete: postId:", published.id, "imageCount:", images.length);
  reportProgress(onProgress, {
    network: SocialNetwork.INSTAGRAM,
    phase: "complete",
    message: "Instagram publish complete",
    completed: totalSteps,
    total: totalSteps,
    percent: 100
  });
  return {
    network: SocialNetwork.INSTAGRAM,
    success: true,
    postId: published.id,
    permalink: permalinkResponse?.permalink,
    imageCount: images.length
  };
}
