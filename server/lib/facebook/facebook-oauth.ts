import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Facebook } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { GraphApiMethod, FacebookPageOption, FacebookTokenHealth } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { GRAPH_API_VERSION, graphApiRequest } from "../social/graph-api";
import { discoverFacebookPages } from "./facebook-publish";

const debugLog = debug(envConfig.logNamespace("facebook:oauth"));
debugLog.enabled = true;

const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management"
];

export function facebookOAuthUrl(appId: string, redirectUri: string, state: string): string {
  if (!appId) {
    throw new Error("Set the Facebook App ID first");
  }
  if (!redirectUri) {
    throw new Error("A redirect URI is required");
  }
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES.join(","),
    state
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForPages(facebook: Facebook, code: string, redirectUri: string): Promise<FacebookPageOption[]> {
  if (!facebook?.appId || !facebook?.appSecret) {
    throw new Error("Set the Facebook App ID and App Secret first");
  }
  if (!code) {
    throw new Error("No authorisation code was returned by Facebook");
  }
  debugLog("exchanging code for pages: redirectUri:", redirectUri);
  const shortLived = await graphApiRequest({
    method: GraphApiMethod.GET,
    path: "/oauth/access_token",
    params: {client_id: facebook.appId, client_secret: facebook.appSecret, redirect_uri: redirectUri, code},
    debug: debugLog
  });
  const longLived = await graphApiRequest({
    method: GraphApiMethod.GET,
    path: "/oauth/access_token",
    params: {grant_type: "fb_exchange_token", client_id: facebook.appId, client_secret: facebook.appSecret, fb_exchange_token: shortLived.access_token},
    debug: debugLog
  });
  return discoverFacebookPages(longLived.access_token);
}

export async function facebookTokenHealth(facebook: Facebook): Promise<FacebookTokenHealth> {
  let health: FacebookTokenHealth;
  if (!facebook?.pageAccessToken) {
    health = {valid: false, error: "No Page is connected yet"};
  } else if (!facebook?.appId || !facebook?.appSecret) {
    health = {valid: false, error: "Set the Facebook App ID and App Secret to check the token"};
  } else {
    try {
      const result = await graphApiRequest({
        method: GraphApiMethod.GET,
        path: "/debug_token",
        params: {input_token: facebook.pageAccessToken, access_token: `${facebook.appId}|${facebook.appSecret}`},
        debug: debugLog
      });
      const data = result?.data || {};
      health = {valid: !!data.is_valid, neverExpires: data.expires_at === 0, expiresAt: data.expires_at || undefined};
    } catch (error) {
      debugLog("token health failed:", error);
      health = {valid: false, error: error?.message || String(error)};
    }
  }
  return health;
}
