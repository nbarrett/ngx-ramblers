import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { GraphApiMethod, SocialPublication } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { graphApiRequest } from "./graph-api";

const debugLog = debug(envConfig.logNamespace("social:publication-status"));
debugLog.enabled = true;

const POST_NO_LONGER_EXISTS_PATTERN = /\(code (100|803)\)|Object (with ID '[^']+' )?does not exist/i;

export function isPostGoneError(error: any): boolean {
  return POST_NO_LONGER_EXISTS_PATTERN.test(error?.message || "");
}

export async function postStillExists(publication: Partial<Pick<SocialPublication, "postId" | "network">>, accessToken: string): Promise<boolean> {
  const checkable = !!publication?.postId && !!accessToken;
  return checkable
    ? await graphApiRequest({
      method: GraphApiMethod.GET,
      path: `/${publication.postId}`,
      params: {fields: "id", access_token: accessToken},
      debug: debugLog
    }).then(() => true).catch(error => {
      const gone = isPostGoneError(error);
      debugLog("existing post check:", publication.network, publication.postId, gone ? "no longer exists" : "check failed so assuming it still exists", error?.message);
      return !gone;
    })
    : true;
}

export async function livePublicationOrNull<T extends Partial<Pick<SocialPublication, "postId" | "network">>>(publication: T, accessToken: string): Promise<T> {
  const live = publication && await postStillExists(publication, accessToken);
  return live ? publication : null;
}
