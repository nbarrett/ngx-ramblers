import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Facebook } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  GraphApiMethod,
  FacebookPageOption,
  FacebookPagePostRequest,
  FacebookPostStyle,
  ResolvedAlbumImage,
  SocialConnectionStatus,
  SocialNetwork,
  SocialProgressCallback,
  SocialPublishProgress,
  SocialPublishResult
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { graphApiRequest } from "../social/graph-api";

const debugLog = debug(envConfig.logNamespace("facebook:publish"));
debugLog.enabled = true;

function reportProgress(onProgress: SocialProgressCallback | null, progress: SocialPublishProgress): void {
  if (onProgress) {
    onProgress(progress);
  }
}

export async function discoverFacebookPages(userAccessToken: string): Promise<FacebookPageOption[]> {
  if (!userAccessToken) {
    throw new Error("Paste an access token first");
  }
  const result = await graphApiRequest({
    method: GraphApiMethod.GET,
    path: "/me/accounts",
    params: {fields: "name,access_token,instagram_business_account", access_token: userAccessToken},
    debug: debugLog
  });
  return (result?.data || []).map((page: any) => ({
    pageId: page.id,
    name: page.name,
    pageAccessToken: page.access_token,
    instagramUserId: page.instagram_business_account?.id
  }));
}

export async function facebookConnectionStatus(facebook: Facebook): Promise<SocialConnectionStatus> {
  let status: SocialConnectionStatus;
  if (!facebook?.pageId || !facebook?.pageAccessToken) {
    status = {network: SocialNetwork.FACEBOOK, connected: false, error: "A Page ID and Page access token are required"};
  } else {
    try {
      const page = await graphApiRequest({
        method: GraphApiMethod.GET,
        path: `/${facebook.pageId}`,
        params: {fields: "name", access_token: facebook.pageAccessToken},
        debug: debugLog
      });
      status = {network: SocialNetwork.FACEBOOK, connected: true, name: page.name};
    } catch (error) {
      debugLog("connection status failed:", error);
      status = {network: SocialNetwork.FACEBOOK, connected: false, error: error?.message || String(error)};
    }
  }
  return status;
}

function assertPublishable(facebook: Facebook): void {
  if (!facebook?.publishingEnabled) {
    throw new Error("Facebook publishing is disabled in System Settings");
  } else if (!facebook?.pageId || !facebook?.pageAccessToken) {
    throw new Error("Facebook publishing is not configured: a Page ID and Page access token are required");
  }
}

async function uploadUnpublishedPhotos(
  facebook: Facebook,
  images: ResolvedAlbumImage[],
  totalSteps: number,
  onProgress: SocialProgressCallback
): Promise<any[]> {
  const uploaded = [];
  for (const image of images) {
    reportProgress(onProgress, {
      network: SocialNetwork.FACEBOOK,
      phase: "upload-image",
      message: `Uploading photo ${uploaded.length + 1} of ${images.length} to Facebook`,
      completed: uploaded.length,
      total: totalSteps,
      percent: Math.round((uploaded.length / totalSteps) * 100)
    });
    const photo = await graphApiRequest({
      method: GraphApiMethod.POST,
      path: `/${facebook.pageId}/photos`,
      params: {url: image.url, published: false, access_token: facebook.pageAccessToken},
      debug: debugLog
    });
    uploaded.push(photo);
  }
  return uploaded;
}

export async function publishToFacebookPage(
  facebook: Facebook,
  {images, caption, link, postStyle}: FacebookPagePostRequest,
  onProgress: SocialProgressCallback = null
): Promise<SocialPublishResult> {
  assertPublishable(facebook);
  const asLinkPost = postStyle === FacebookPostStyle.LINK_PREVIEW || images.length === 0;
  const imagesToUpload = asLinkPost ? [] : images;
  const totalSteps = imagesToUpload.length + 1;
  debugLog("publish starting: pageId:", facebook.pageId, "imageCount:", imagesToUpload.length, "linkPost:", asLinkPost, "urls:", imagesToUpload.map(image => image.url));
  reportProgress(onProgress, {
    network: SocialNetwork.FACEBOOK,
    phase: "prepare",
    message: asLinkPost ? "Preparing Facebook post" : `Preparing ${imagesToUpload.length} Facebook photos`,
    completed: 0,
    total: totalSteps,
    percent: 0
  });
  const uploaded = await uploadUnpublishedPhotos(facebook, imagesToUpload, totalSteps, onProgress);
  reportProgress(onProgress, {
    network: SocialNetwork.FACEBOOK,
    phase: "publish",
    message: "Publishing Facebook post",
    completed: imagesToUpload.length,
    total: totalSteps,
    percent: Math.round((imagesToUpload.length / totalSteps) * 100)
  });
  const attachedMedia = uploaded.map(photo => ({media_fbid: photo.id}));
  const post = await graphApiRequest({
    method: GraphApiMethod.POST,
    path: `/${facebook.pageId}/feed`,
    params: {
      message: caption,
      link: asLinkPost ? link : null,
      attached_media: attachedMedia.length > 0 ? JSON.stringify(attachedMedia) : null,
      access_token: facebook.pageAccessToken
    },
    debug: debugLog
  });
  debugLog("publish complete: postId:", post.id, "imageCount:", imagesToUpload.length);
  reportProgress(onProgress, {
    network: SocialNetwork.FACEBOOK,
    phase: "complete",
    message: "Facebook publish complete",
    completed: totalSteps,
    total: totalSteps,
    percent: 100
  });
  return {
    network: SocialNetwork.FACEBOOK,
    success: true,
    postId: post.id,
    permalink: `https://www.facebook.com/${post.id}`,
    imageCount: imagesToUpload.length
  };
}

export async function publishAlbumToFacebook(
  facebook: Facebook,
  images: ResolvedAlbumImage[],
  caption: string,
  onProgress: SocialProgressCallback = null
): Promise<SocialPublishResult> {
  return publishToFacebookPage(facebook, {images, caption, postStyle: FacebookPostStyle.PHOTO_WITH_LINK}, onProgress);
}
