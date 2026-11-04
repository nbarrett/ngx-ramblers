import { JSDOM } from "jsdom";
import { ScrapedImage } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { uniqBy } from "es-toolkit/compat";

const LAYOUT_IMAGE_NAME = /(?:^|[\s_.-])(?:previous|prev|pause|next|play|home|back|forward|arrow|arrows|backarrow|logo|icon|icons|btn|button|spacer|bullet|nav|navigation|loading)(?:[\s_.-]|\d|$)/i;
const CHROME_IMAGE_STEM = /^(?:banner|masthead|footer)(?:\d+)?\.[a-z0-9]+$/i;

export function thumbnailImage(src: string): boolean {
  return /(?:^|[\/_.-])thumb(?:nail)?s?(?:[\/_.-]|$)/i.test(src || "");
}

export function layoutImage(image: ScrapedImage): boolean {
  try {
    const path = decodeURIComponent(new URL(image.src).pathname);
    const file = path.split("/").pop() || "";
    return LAYOUT_IMAGE_NAME.test(file)
      || CHROME_IMAGE_STEM.test(file)
      || /\/(?:icons?|buttons?|navigation)\//i.test(path)
      || /^(?:home|back|next|previous|prev|play|pause|loading|logo)(?:\s+(?:image|photo|page))?$/i.test((image.alt || "").trim());
  } catch (error) {
    const file = (image.src || "").split("/").pop() || image.src || "";
    return LAYOUT_IMAGE_NAME.test(file) || CHROME_IMAGE_STEM.test(file);
  }
}

export function withoutLayoutImages(html: string, pageUrl: string): string {
  const document = new JSDOM(html, {url: pageUrl}).window.document;
  [...document.querySelectorAll("img")].forEach(image => {
    const raw = image.getAttribute("data-large") || image.getAttribute("data-src") || image.getAttribute("src") || "";
    try {
      image.setAttribute("src", new URL(raw, pageUrl).href);
    } catch (error) {
      image.setAttribute("src", raw);
    }
    if (layoutImage({src: image.src, alt: image.alt}) || thumbnailImage(image.src)) {
      image.remove();
    }
  });
  return document.body.innerHTML;
}

export function albumContentImages(images: ScrapedImage[]): ScrapedImage[] {
  return uniqBy(images.filter(image => !layoutImage(image) && !thumbnailImage(image.src)), image => image.src);
}

export function contentImagesFromHtml(html: string, pageUrl: string): ScrapedImage[] {
  const document = new JSDOM(html || "", {url: pageUrl || "https://group.example.org.uk/"}).window.document;
  const images = [...document.querySelectorAll("img")].map(image => {
    const raw = image.getAttribute("data-large") || image.getAttribute("data-src") || image.getAttribute("src") || "";
    try {
      return {src: new URL(raw, pageUrl).href, alt: (image.getAttribute("alt") || "").trim()};
    } catch (error) {
      return {src: raw, alt: (image.getAttribute("alt") || "").trim()};
    }
  }).filter(image => !!image.src && !/^data:/i.test(image.src) && !/blank\.gif/i.test(image.src));
  return albumContentImages(images);
}
