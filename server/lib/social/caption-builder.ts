import { SocialPublishCaptionInput } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";

export function buildCaption({writeUp, hashtags, mentions}: SocialPublishCaptionInput): string {
  const mentionLine = (mentions || []).filter(Boolean).map(mention => mention.startsWith("@") ? mention : `@${mention}`).join(" ");
  const hashtagLine = (hashtags || []).filter(Boolean).map(hashtag => hashtag.startsWith("#") ? hashtag : `#${hashtag}`).join(" ");
  return [writeUp?.trim(), mentionLine, hashtagLine]
    .filter(part => part && part.length > 0)
    .join("\n\n");
}

export function withLink(caption: string, url: string, label: string): string {
  const trimmed = (caption || "").trim();
  if (url && !trimmed.includes(url)) {
    return [trimmed, `${label} ${url}`].filter(part => part.length > 0).join("\n\n");
  } else {
    return trimmed;
  }
}
