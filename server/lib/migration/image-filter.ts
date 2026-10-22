import { JSDOM } from "jsdom";
import { ScrapedImage } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { uniqBy } from "es-toolkit/compat";

const LAYOUT_IMAGE_NAME = /(?:^|[\s_.-])(?:previous|prev|pause|next|play|home|back|forward|arrow|arrows|logo|icon|icons|btn|button|spacer|bullet|nav|navigation|loading)(?:[\s_.-]|\d|$)/i;

export function thumbnailImage(src: string): boolean {
  return /(?:^|[\/_.-])thumb(?:nail)?s?(?:[\/_.-]|$)/i.test(src || "");
}

export function layoutImage(image: ScrapedImage): boolean {
  try {
    const path = decodeURIComponent(new URL(image.src).pathname);
    return LAYOUT_IMAGE_NAME.test(path.split("/").pop() || "")
      || /\/(?:icons?|buttons?|navigation)\//i.test(path)
      || /^(?:home|back|next|previous|prev|play|pause|loading|logo)(?:\s+(?:image|photo|page))?$/i.test((image.alt || "").trim());
  } catch (error) {
    return LAYOUT_IMAGE_NAME.test(image.src || "");
  }
}

export function withoutLayoutImages(html: string, pageUrl: string): string {
  const document = new JSDOM(html, {url: pageUrl}).window.document;
  [...document.querySelectorAll("img")]
    .filter(image => layoutImage({src: image.src, alt: image.alt}))
    .forEach(image => image.remove());
  return document.body.innerHTML;
}

export function albumContentImages(images: ScrapedImage[]): ScrapedImage[] {
  return uniqBy(images.filter(image => !layoutImage(image) && !thumbnailImage(image.src)), image => image.src);
}
