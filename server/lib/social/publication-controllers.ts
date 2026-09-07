import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { socialPublication } from "../mongo/models/social-publication";
import { DeletePublicationRequest, SocialNetwork, SocialPublication } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { isPostGoneError, postStillExists } from "./publication-status";
import { deleteFacebookPost } from "../facebook/facebook-publish";

const debugLog = debug(envConfig.logNamespace("social:publication-controllers"));
debugLog.enabled = true;

const PUBLICATION_FIELDS = "albumName network postId permalink imageCount publishedAt";

async function removeIfGone(publication: SocialPublication, accessToken: string): Promise<SocialPublication> {
  const exists = await postStillExists(publication, accessToken);
  if (!exists) {
    debugLog("removing record of deleted post:", publication.network, publication.postId, "album:", publication.albumName);
    await socialPublication.deleteMany({albumName: publication.albumName, network: publication.network, postId: publication.postId});
  }
  return exists ? publication : null;
}

export async function albumPublications(req: Request, res: Response): Promise<void> {
  const albumName = req.query.albumName as string;
  const verify = req.query.verify === "true";
  try {
    const recorded = await socialPublication.find({albumName}, PUBLICATION_FIELDS)
      .sort({publishedAt: -1}).lean().exec() as unknown as SocialPublication[];
    const accessToken = verify ? (await systemConfig())?.externalSystems?.facebook?.pageAccessToken : null;
    const response = verify
      ? (await Promise.all(recorded.map(publication => removeIfGone(publication, accessToken)))).filter(publication => !!publication)
      : recorded;
    res.json({request: {albumName, verify}, response});
  } catch (error) {
    debugLog("album publications error:", error);
    res.status(500).json({request: {albumName, verify}, response: [], error: error?.message || String(error)});
  }
}

export async function deletePublication(req: Request, res: Response): Promise<void> {
  const request: DeletePublicationRequest = req.body;
  try {
    if (request.network !== SocialNetwork.FACEBOOK) {
      throw new Error("Only Facebook posts can be deleted from here. Delete Instagram posts in the Instagram app.");
    }
    if (!request.postId) {
      throw new Error("No post to delete");
    }
    const config = await systemConfig();
    const facebook = config?.externalSystems?.facebook;
    try {
      await deleteFacebookPost(facebook, request.postId);
      debugLog("deleted post on request:", request.network, request.postId, "album:", request.albumName, "event:", request.eventId);
    } catch (error) {
      if (isPostGoneError(error)) {
        debugLog("post was already gone:", request.network, request.postId);
      } else {
        throw error;
      }
    }
    await socialPublication.deleteMany({network: request.network, postId: request.postId});
    res.json({request, response: {deleted: true}});
  } catch (error) {
    debugLog("delete publication error:", error);
    res.status(502).json({request, response: {deleted: false}, error: error?.message || String(error)});
  }
}
