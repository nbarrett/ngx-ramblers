import debug from "debug";
import { isArray } from "es-toolkit/compat";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import { graphApiRequest } from "../social/graph-api";
import { GraphApiMethod } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import {
  FacebookGraphAttachment,
  FacebookGraphPost,
  FacebookGraphProfile,
  FacebookPageProfile,
  FacebookPagePost
} from "../../../projects/ngx-ramblers/src/app/models/facebook.model";

const debugLog = debug(envConfig.logNamespace("facebook:recent-posts"));
debugLog.enabled = false;
const POST_FIELDS = "id,message,story,created_time,permalink_url,full_picture,from{id,name},attachments{media_type,media,subattachments}";
const PROFILE_FIELDS = "name,username,followers_count,fan_count,link,picture.type(large)";
const FEED_LIMIT = 12;

function attachmentFor(post: FacebookGraphPost): FacebookGraphAttachment {
  return isArray(post?.attachments?.data) ? post.attachments.data[0] : null;
}

function imageUrlFor(post: FacebookGraphPost): string {
  const attachment = attachmentFor(post);
  return post?.full_picture || attachment?.media?.image?.src || "";
}

function imageCountFor(post: FacebookGraphPost): number {
  const subAttachments = attachmentFor(post)?.subattachments?.data;
  return isArray(subAttachments) && subAttachments.length > 0 ? subAttachments.length : (imageUrlFor(post) ? 1 : 0);
}

function normalisePost(post: FacebookGraphPost, pageId: string): FacebookPagePost {
  const author = post?.from;
  return {
    id: post.id,
    message: post.message || post.story || "",
    createdTime: post.created_time,
    permalink: post.permalink_url || `https://www.facebook.com/${post.id}`,
    imageUrl: imageUrlFor(post),
    imageCount: imageCountFor(post),
    authorName: author?.id && author.id !== pageId ? author.name || "" : ""
  };
}

function normaliseProfile(profile: FacebookGraphProfile): FacebookPageProfile {
  return {
    name: profile?.name || "",
    username: profile?.username || "",
    followersCount: profile?.followers_count || profile?.fan_count || 0,
    profilePictureUrl: profile?.picture?.data?.url || "",
    link: profile?.link || ""
  };
}

async function postsFor(pageId: string, accessToken: string): Promise<FacebookGraphPost[]> {
  const params = {fields: POST_FIELDS, access_token: accessToken, limit: FEED_LIMIT};
  try {
    const feed = await graphApiRequest({
      method: GraphApiMethod.GET,
      path: `/${pageId}/feed`,
      params,
      debug: debugLog
    });
    return isArray(feed?.data) ? feed.data : [];
  } catch (error) {
    debugLog("feed failed - falling back to published_posts:", error?.message || error);
    const published = await graphApiRequest({
      method: GraphApiMethod.GET,
      path: `/${pageId}/published_posts`,
      params,
      debug: debugLog
    });
    return isArray(published?.data) ? published.data : [];
  }
}

export async function recentPosts(req: Request, res: Response): Promise<void> {
  try {
    const config: SystemConfig = await systemConfig();
    const facebook = config?.externalSystems?.facebook;
    if (!facebook?.pageId || !facebook?.pageAccessToken) {
      res.status(400).json({
        request: {},
        error: "The Facebook feed needs a connected Page (System Settings → External Systems → Social Media)"
      });
    } else {
      const [rawPosts, profileResponse] = await Promise.all([
        postsFor(facebook.pageId, facebook.pageAccessToken),
        graphApiRequest({
          method: GraphApiMethod.GET,
          path: `/${facebook.pageId}`,
          params: {fields: PROFILE_FIELDS, access_token: facebook.pageAccessToken},
          debug: debugLog
        }).catch(error => {
          debugLog("page profile lookup failed - continuing without it:", error?.message || error);
          return null;
        })
      ]);
      const data: FacebookPagePost[] = rawPosts
        .map(post => normalisePost(post, facebook.pageId))
        .filter(post => post.imageUrl || post.message);
      const profile: FacebookPageProfile = profileResponse ? normaliseProfile(profileResponse) : null;
      debugLog("recent posts:", data.length, "of", rawPosts.length, "from Graph API, profile:", profile);
      res.json({request: {}, response: {data, profile}});
    }
  } catch (error) {
    debugLog("error in recentPosts:", error);
    res.status(502).json({request: {}, error: error?.message || String(error)});
  }
}
