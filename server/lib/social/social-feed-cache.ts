import { SocialNetwork } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { clearRecentMediaCache } from "../instagram/recent-media";
import { clearRecentPostsCache } from "../facebook/recent-posts";

export function clearSocialFeedCache(network: SocialNetwork): void {
  if (network === SocialNetwork.INSTAGRAM) {
    clearRecentMediaCache();
  } else {
    clearRecentPostsCache();
  }
}
