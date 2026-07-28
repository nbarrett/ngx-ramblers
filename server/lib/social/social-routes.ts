import express, { Request, Response } from "express";
import debug from "debug";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ResolvedAlbumImage, SocialNetwork, SocialPublishRequest, SocialPublishResult } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { resolveAlbumImages } from "./album-images";
import { discoverFacebookPages, facebookConnectionStatus, publishAlbumToFacebook } from "../facebook/facebook-publish";
import { exchangeCodeForPages, facebookOAuthUrl, facebookTokenHealth } from "../facebook/facebook-oauth";
import { instagramConnectionStatus, publishAlbumToInstagram } from "../instagram/instagram-publish";
import { recentMedia } from "../instagram/recent-media";
import { socialPublication } from "../mongo/models/social-publication";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("social:publish"));
debugLog.enabled = true;

const router = express.Router();

function requestBaseUrl(req: Request): string {
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  return `${protocol}://${req.get("host")}`;
}

function isLocalHost(hostname: string): boolean {
  const host = (hostname || "").toLowerCase().split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local");
}

function publicImageBaseUrl(req: Request, config: SystemConfig): string {
  const fromRequest = requestBaseUrl(req);
  const configured = (config?.group?.href || "").trim().replace(/\/+$/, "");
  let hostname = "";
  try {
    hostname = new URL(fromRequest).hostname;
  } catch {
    hostname = req.get("host") || "";
  }
  let baseUrl = fromRequest;
  if (configured && isLocalHost(hostname)) {
    debugLog("using group.href for public image base URL:", configured, "instead of:", fromRequest);
    baseUrl = configured;
  }
  return baseUrl;
}

async function publish(req: Request, res: Response, network: SocialNetwork, publisher: (config: SystemConfig, images: ResolvedAlbumImage[], caption: string) => Promise<SocialPublishResult>) {
  const request: SocialPublishRequest = req.body;
  try {
    const config: SystemConfig = await systemConfig();
    const existing = await socialPublication.findOne({albumName: request.albumName, network}).lean().exec() as {postId?: string; permalink?: string} | null;
    if (existing) {
      const response: SocialPublishResult = {
        network,
        success: false,
        error: `This album has already been published to ${network} (post ${existing.postId || existing.permalink || "recorded"})`
      };
      res.status(409).json({request, response, error: response.error});
    } else {
      const baseUrl = publicImageBaseUrl(req, config);
      debugLog(network, "publish request: album:", request.albumName, "imageCount:", request.imageNames?.length, "baseUrl:", baseUrl);
      const images = await resolveAlbumImages(baseUrl, request.albumName, request.imageNames);
      const response = await publisher(config, images, request.caption);
      if (response.success) {
        await socialPublication.create({
          albumName: request.albumName,
          network: response.network,
          postId: response.postId,
          permalink: response.permalink,
          imageCount: response.imageCount,
          imageNames: request.imageNames,
          caption: request.caption,
          publishedAt: dateTimeNowAsValue()
        });
        debugLog(network, "publish succeeded: postId:", response.postId, "permalink:", response.permalink);
      } else {
        debugLog(network, "publish returned failure:", response.error);
      }
      res.json({request, response});
    }
  } catch (error) {
    debugLog(network, "publish error:", error);
    const response: SocialPublishResult = {network, success: false, error: error?.message || String(error)};
    res.status(502).json({request, response, error: response.error});
  }
}

router.post("/facebook/publish-album", authConfig.authenticate(), (req: Request, res: Response) =>
  publish(req, res, SocialNetwork.FACEBOOK, (config, images, caption) =>
    publishAlbumToFacebook(config?.externalSystems?.facebook, images, caption, null)));

router.post("/instagram/publish-album", authConfig.authenticate(), (req: Request, res: Response) =>
  publish(req, res, SocialNetwork.INSTAGRAM, (config, images, caption) =>
    publishAlbumToInstagram(config?.externalSystems?.instagram, config?.externalSystems?.facebook?.pageAccessToken, images, caption, null)));

router.post("/facebook/discover-pages", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const response = await discoverFacebookPages(req.body?.accessToken);
    res.json({request: {}, response});
  } catch (error) {
    debugLog("discover-pages error:", error);
    res.status(502).json({request: {}, response: [], error: error?.message || String(error)});
  }
});

router.get("/facebook/oauth/url", authConfig.authenticate(), async (req: Request, res: Response) => {
  const config: SystemConfig = await systemConfig();
  try {
    const url = facebookOAuthUrl(config?.externalSystems?.facebook?.appId, req.query.redirectUri as string, (req.query.state as string) || "facebook");
    res.json({request: {}, response: {url}});
  } catch (error) {
    res.status(400).json({request: {}, error: error?.message || String(error)});
  }
});

router.post("/facebook/oauth/exchange", authConfig.authenticate(), async (req: Request, res: Response) => {
  const config: SystemConfig = await systemConfig();
  try {
    const response = await exchangeCodeForPages(config?.externalSystems?.facebook, req.body?.code, req.body?.redirectUri);
    res.json({request: {}, response});
  } catch (error) {
    debugLog("oauth exchange error:", error);
    res.status(502).json({request: {}, response: [], error: error?.message || String(error)});
  }
});

router.get("/facebook/token-health", authConfig.authenticate(), async (_req: Request, res: Response) => {
  const config: SystemConfig = await systemConfig();
  const response = await facebookTokenHealth(config?.externalSystems?.facebook);
  res.json({request: {}, response});
});

router.get("/facebook/status", authConfig.authenticate(), async (_req: Request, res: Response) => {
  const config: SystemConfig = await systemConfig();
  const response = await facebookConnectionStatus(config?.externalSystems?.facebook);
  res.json({request: {}, response});
});

router.get("/instagram/status", authConfig.authenticate(), async (_req: Request, res: Response) => {
  const config: SystemConfig = await systemConfig();
  const response = await instagramConnectionStatus(config?.externalSystems?.instagram, config?.externalSystems?.facebook?.pageAccessToken);
  res.json({request: {}, response});
});

router.get("/instagram/recent-media", recentMedia);

router.get("/publications", authConfig.authenticate(), async (req: Request, res: Response) => {
  const albumName = req.query.albumName as string;
  const response = await socialPublication.find({albumName}).sort({publishedAt: -1}).lean().exec();
  res.json({request: {albumName}, response});
});

export const socialRoutes = router;
