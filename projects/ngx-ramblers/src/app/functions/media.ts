import { Media } from "../models/ramblers-walks-manager";
import { HasMedia } from "../models/group-events.model";

export const MEDIUM_STYLE = "medium";

export function mediaFrom(title: string, imageUrl: string): Media {
  return {
    caption: null,
    credit: null,
    title,
    alt: title,
    styles: [{style: MEDIUM_STYLE, url: imageUrl, width: 0, height: 0}]
  };
}

export function mediumStyleUrlFrom(media: Media): string {
  return media?.styles?.find(style => style.style === MEDIUM_STYLE)?.url;
}

export function applyImageSourceTo(hasMedia: HasMedia, title: string, imageUrl: string): void {
  const alreadyPresent = hasMedia?.media?.find(item => item.styles?.find(style => style.url === imageUrl));
  if (!alreadyPresent) {
    const media = mediaFrom(title, imageUrl);
    if (!hasMedia.media) {
      hasMedia.media = [media];
    } else {
      hasMedia.media.push(media);
    }
  }
}
