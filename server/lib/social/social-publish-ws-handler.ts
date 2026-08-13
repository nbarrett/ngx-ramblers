import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  SocialNetwork,
  SocialPublishJobRequest,
  SocialPublishProgress,
  SocialPublishResult
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import { resolveAlbumImages } from "./album-images";
import { publishAlbumToFacebook } from "../facebook/facebook-publish";
import { withLink } from "./caption-builder";
import { publishAlbumToInstagram } from "../instagram/instagram-publish";
import { socialPublication } from "../mongo/models/social-publication";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("social:publish-ws"));
debugLog.enabled = true;

function sendProgress(ws: WebSocket, jobId: string, progress: SocialPublishProgress): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: {action: ApiAction.UPDATE, jobId, ...progress}
    }));
  }
}

function sendError(ws: WebSocket, jobId: string, message: string, data?: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: {action: ApiAction.UPDATE, jobId, message, ...data}
    }));
  }
}

function sendComplete(ws: WebSocket, jobId: string, message: string, data?: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: MessageType.COMPLETE,
      data: {action: ApiAction.UPDATE, jobId, message, ...data}
    }));
  }
}

function publicBaseUrlFor(config: SystemConfig, requestedBaseUrl?: string): string {
  const configured = (config?.group?.href || "").trim().replace(/\/+$/, "");
  const requested = (requestedBaseUrl || "").trim().replace(/\/+$/, "");
  let baseUrl = "";
  if (configured) {
    baseUrl = configured;
  } else if (requested) {
    baseUrl = requested;
  } else {
    throw new Error("Set Web Url in System Settings → Area & Group so social networks can fetch album images");
  }
  return baseUrl;
}

async function recordPublication(albumName: string, result: SocialPublishResult, imageNames: string[], caption: string): Promise<void> {
  if (result.success) {
    await socialPublication.create({
      albumName,
      network: result.network,
      postId: result.postId,
      permalink: result.permalink,
      imageCount: result.imageCount,
      imageNames,
      caption,
      publishedAt: dateTimeNowAsValue()
    });
  }
}

export async function handleSocialPublishAlbum(ws: WebSocket, data: SocialPublishJobRequest): Promise<void> {
  const jobId = data?.jobId || `social-publish-${dateTimeNowAsValue()}`;
  debugLog("handleSocialPublishAlbum: received request", {
    jobId,
    albumName: data?.albumName,
    networks: data?.networks,
    imageCount: data?.imageNames?.length
  });
  try {
    const albumName = data?.albumName;
    const networks = (data?.networks || []).filter(Boolean);
    const imageNames = data?.imageNames || [];
    if (!albumName) {
      sendError(ws, jobId, "Album name is required");
    } else if (networks.length === 0) {
      sendError(ws, jobId, "Choose at least one network to publish to");
    } else if (imageNames.length === 0) {
      sendError(ws, jobId, "Select at least one image to publish");
    } else {
      const config: SystemConfig = await systemConfig();
      const baseUrl = publicBaseUrlFor(config, data?.publicBaseUrl);
      const results: SocialPublishResult[] = [];
      const imageNamesFor = (network: SocialNetwork): string[] => {
        const perNetwork = data?.imageNamesByNetwork?.[network];
        return perNetwork?.length ? perNetwork : imageNames;
      };
      const allImageNames = Array.from(new Set(networks.flatMap(network => imageNamesFor(network))));
      sendProgress(ws, jobId, {
        message: `Resolving ${allImageNames.length} album images`,
        phase: "resolve-images",
        completed: 0,
        total: networks.length,
        percent: 0
      });
      const resolvedImages = await resolveAlbumImages(baseUrl, albumName, allImageNames);
      const imagesByName = new Map(resolvedImages.map(image => [image.image, image]));
      debugLog("resolved images:", resolvedImages.length, "baseUrl:", baseUrl);
      for (const network of networks) {
        const enteredCaption = data?.captions?.[network] || "";
        const caption = withLink(enteredCaption, data?.albumUrl, "See the full album:");
        const networkImageNames = imageNamesFor(network);
        const networkImages = networkImageNames.map(name => imagesByName.get(name)).filter(Boolean);
        if (!enteredCaption?.trim()) {
          results.push({network, success: false, error: `A caption is required for ${network}`});
        } else if (networkImages.length === 0) {
          results.push({network, success: false, error: `Select at least one image to publish to ${network}`});
        } else {
          const existing = await socialPublication.findOne({albumName, network}).lean().exec() as {postId?: string; permalink?: string} | null;
          if (existing) {
            results.push({
              network,
              success: false,
              error: `This album has already been published to ${network} (post ${existing.postId || existing.permalink || "recorded"})`
            });
          } else {
            sendProgress(ws, jobId, {
              network,
              phase: "network-start",
              message: `Starting ${network} publish`,
              completed: results.filter(result => result.success).length,
              total: networks.length,
              percent: Math.round((results.length / Math.max(networks.length, 1)) * 100)
            });
            try {
              const onProgress = (progress: SocialPublishProgress) => sendProgress(ws, jobId, progress);
              const result = network === SocialNetwork.FACEBOOK
                ? await publishAlbumToFacebook(config?.externalSystems?.facebook, networkImages, caption, onProgress)
                : await publishAlbumToInstagram(
                  config?.externalSystems?.instagram,
                  config?.externalSystems?.facebook?.pageAccessToken,
                  networkImages,
                  caption,
                  onProgress
                );
              await recordPublication(albumName, result, networkImageNames, caption);
              results.push(result);
            } catch (error) {
              debugLog(network, "publish failed:", error);
              results.push({network, success: false, error: error?.message || String(error)});
            }
          }
        }
      }
      const successCount = results.filter(result => result.success).length;
      const failureCount = results.length - successCount;
      if (successCount === 0) {
        sendError(ws, jobId, failureCount === 1 ? results[0]?.error || "Publish failed" : "Publish failed for all selected networks", {results});
      } else {
        sendComplete(ws, jobId, failureCount === 0
          ? `Published to ${successCount === 1 ? results.find(result => result.success)?.network : `${successCount} networks`}`
          : `Published to ${successCount} of ${results.length} networks`,
          {results});
      }
    }
  } catch (error) {
    debugLog("handleSocialPublishAlbum error:", error);
    sendError(ws, jobId, error?.message || String(error));
  }
}
