import debug from "debug";
import { isArray } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { Request, Response } from "express";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import { graphApiRequest } from "../social/graph-api";
import { GraphApiMethod } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import {
  InstagramGraphMediaChild,
  InstagramGraphMediaItem,
  InstagramMediaPost
} from "../../../projects/ngx-ramblers/src/app/models/instagram.model";

const debugLog = debug(envConfig.logNamespace("instagram:recent-media"));
debugLog.enabled = false;
const MEDIA_FIELDS = "id,media_type,media_url,thumbnail_url,permalink,username,timestamp,caption,children{media_url,media_type,thumbnail_url}";
const FEED_LIMIT = 14;

function childMediaUrl(item: InstagramGraphMediaItem): string {
  const children: InstagramGraphMediaChild[] = isArray(item?.children?.data) ? item.children.data : [];
  const withUrl = children.find(child => child?.media_url || child?.thumbnail_url);
  return withUrl?.media_url || withUrl?.thumbnail_url || "";
}

function displayMediaUrl(item: InstagramGraphMediaItem): string {
  return item?.media_url || item?.thumbnail_url || childMediaUrl(item) || "";
}

function normaliseMediaItem(item: InstagramGraphMediaItem): InstagramMediaPost {
  return {
    id: item.id,
    media_type: item.media_type,
    media_url: displayMediaUrl(item),
    permalink: item.permalink,
    username: item.username,
    timestamp: item.timestamp,
    caption: item.caption || ""
  };
}

export async function recentMedia(req: Request, res: Response): Promise<void> {
  try {
    const config: SystemConfig = await systemConfig();
    const instagram = config?.externalSystems?.instagram;
    const pageAccessToken = config?.externalSystems?.facebook?.pageAccessToken;
    if (!instagram?.igUserId || !pageAccessToken) {
      res.status(400).json({
        request: {},
        error: "Instagram feed needs a Facebook Page connection with a linked Instagram account (System Settings → External Systems → Social Media)"
      });
    } else {
      const graphResponse = await graphApiRequest({
        method: GraphApiMethod.GET,
        path: `/${instagram.igUserId}/media`,
        params: {
          fields: MEDIA_FIELDS,
          access_token: pageAccessToken,
          limit: FEED_LIMIT
        },
        debug: debugLog
      });
      const rawItems: InstagramGraphMediaItem[] = isArray(graphResponse?.data) ? graphResponse.data : [];
      const data: InstagramMediaPost[] = rawItems.filter(item => displayMediaUrl(item)).slice(0, FEED_LIMIT).map(normaliseMediaItem);
      debugLog("recent media items:", data.length, "of", rawItems.length, "from Graph API");
      res.json({request: {}, response: {data}});
    }
  } catch (error) {
    debugLog("error in recentMedia:", error);
    res.status(502).json({request: {}, error: error?.message || String(error)});
  }
}
