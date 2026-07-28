import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Facebook } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  GraphApiMethod,
  FacebookPageOption,
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

export async function publishAlbumToFacebook(
  facebook: Facebook,
  images: ResolvedAlbumImage[],
  caption: string,
  onProgress: SocialProgressCallback = null
): Promise<SocialPublishResult> {
  if (!facebook?.publishingEnabled) {
    throw new Error("Facebook publishing is disabled in System Settings");
  }
  if (!facebook?.pageId || !facebook?.pageAccessToken) {
    throw new Error("Facebook publishing is not configured: a Page ID and Page access token are required");
  }
  const accessToken = facebook.pageAccessToken;
  const totalSteps = images.length + 1;
  debugLog("publish starting: pageId:", facebook.pageId, "imageCount:", images.length, "urls:", images.map(image => image.url));
  reportProgress(onProgress, {
    network: SocialNetwork.FACEBOOK,
    phase: "prepare",
    message: `Preparing ${images.length} Facebook photos`,
    completed: 0,
    total: totalSteps,
    percent: 0
  });
  const uploaded = [];
  for (const image of images) {
    const imageIndex = uploaded.length + 1;
    reportProgress(onProgress, {
      network: SocialNetwork.FACEBOOK,
      phase: "upload-image",
      message: `Uploading photo ${imageIndex} of ${images.length} to Facebook`,
      completed: uploaded.length,
      total: totalSteps,
      percent: Math.round((uploaded.length / totalSteps) * 100)
    });
    const photo = await graphApiRequest({
      method: GraphApiMethod.POST,
      path: `/${facebook.pageId}/photos`,
      params: {url: image.url, published: false, access_token: accessToken},
      debug: debugLog
    });
    uploaded.push(photo);
  }
  reportProgress(onProgress, {
    network: SocialNetwork.FACEBOOK,
    phase: "publish",
    message: "Publishing Facebook post",
    completed: images.length,
    total: totalSteps,
    percent: Math.round((images.length / totalSteps) * 100)
  });
  const attachedMedia = uploaded.map(photo => ({media_fbid: photo.id}));
  const post = await graphApiRequest({
    method: GraphApiMethod.POST,
    path: `/${facebook.pageId}/feed`,
    params: {message: caption, attached_media: JSON.stringify(attachedMedia), access_token: accessToken},
    debug: debugLog
  });
  debugLog("publish complete: postId:", post.id, "imageCount:", images.length);
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
    imageCount: images.length
  };
}
