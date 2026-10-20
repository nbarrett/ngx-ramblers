import { JSDOM } from "jsdom";
import { PageLink } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { ScrapedImage } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";

const IMAGE_HELPER = /\/components\/com_eventgallery\/helpers\/image\.php/i;
const COMPONENT = /(?:\?|&)option=com_eventgallery(?:&|$)/i;
const ALBUM_VIEW = /(?:\?|&)view=(?:event|singleimage)(?:&|$)/i;
const LISTING_VIEW = /(?:\?|&)view=(?:events|categories|eventlist)(?:&|$)/i;
const SEF_ALBUM_SEGMENT = /\/event\//i;

export function isEventGalleryComponentUrl(url: string): boolean {
  return COMPONENT.test(url || "") || IMAGE_HELPER.test(url || "");
}

export function isEventGalleryAlbumUrl(url: string): boolean {
  if (!url) {
    return false;
  } else if (COMPONENT.test(url)) {
    return ALBUM_VIEW.test(url) || /(?:\?|&)folder=/i.test(url);
  } else {
    return SEF_ALBUM_SEGMENT.test(url);
  }
}

export function isEventGalleryListingUrl(url: string): boolean {
  const withoutQuery = (url || "").split("?")[0];
  if (isEventGalleryAlbumUrl(url)) {
    return false;
  } else if (COMPONENT.test(url || "")) {
    return !ALBUM_VIEW.test(url) && (LISTING_VIEW.test(url) || !/(?:\?|&)view=/i.test(url) || /[?&]start=\d+/i.test(url));
  } else {
    return /[?&]start=\d+/i.test(url || "") && !SEF_ALBUM_SEGMENT.test(withoutQuery);
  }
}

export function isEventGalleryListingHtml(html: string, pageUrl = ""): boolean {
  const document = new JSDOM(html || "", {url: pageUrl || "https://group.example.org.uk/"}).window.document;
  const egLinks = document.querySelectorAll("[data-eg-link]").length;
  const grid = document.querySelector(".eventgallery-events, .eventgallery-events-gridlist, .eventgallery-categories, .eventgallery-events-list");
  const componentMarker = /com_eventgallery/i.test(html || "");
  const albums = eventGalleryAlbumLinksFromHtml(html || "", pageUrl || "https://group.example.org.uk/");
  return egLinks >= 2 || !!grid || (componentMarker && albums.length >= 2) || eventGalleryIndexImages(eventGalleryImagesFromHtml(html || "", pageUrl || "https://group.example.org.uk/"));
}

export function isGalleryPaginationPath(path: string, url = ""): boolean {
  return /[?&]start=\d+/i.test(url) || /^(photos|gallery)\/\d+(\/\d+)*$/.test(path || "");
}

export function eventGalleryFolderFromUrl(src: string): string {
  try {
    return new URL(src).searchParams.get("folder") || "";
  } catch (error) {
    return "";
  }
}

export function eventGalleryDisplayUrl(src: string): string {
  try {
    const url = new URL(src);
    if (IMAGE_HELPER.test(url.pathname) && url.searchParams.get("width") === "160") {
      url.searchParams.set("width", "1600");
    }
    return url.href;
  } catch (error) {
    return src;
  }
}

export function eventGalleryAlbumLinksFromHtml(html: string, pageUrl: string): PageLink[] {
  const document = new JSDOM(html, {url: pageUrl}).window.document;
  const items = [...document.querySelectorAll("[data-eg-link], a[href]")].map(node => {
    const href = node.getAttribute("data-eg-link") || (node as HTMLAnchorElement).href || "";
    const image = node.querySelector("img") || (node.matches("img") ? node as HTMLImageElement : null);
    const title = (image?.getAttribute("alt") || node.textContent || "").replace(/\s+/g, " ").trim();
    return href ? {path: new URL(href, pageUrl).href, title} : null;
  }).filter((link): link is PageLink => !!link && isEventGalleryAlbumUrl(link.path) && !!link.title);
  return items.filter((link, index) => items.findIndex(item => item.path === link.path) === index);
}

export function eventGalleryPaginationUrls(html: string, pageUrl: string): string[] {
  const document = new JSDOM(html, {url: pageUrl}).window.document;
  const listingPath = (() => {
    try {
      return new URL(pageUrl).pathname;
    } catch (error) {
      return "";
    }
  })();
  return [...document.querySelectorAll("a[href]")].map(link => {
    try {
      return new URL((link as HTMLAnchorElement).href, pageUrl).href;
    } catch (error) {
      return "";
    }
  }).filter(href => {
    if (!/[?&]start=\d+/i.test(href) || isEventGalleryAlbumUrl(href)) {
      return false;
    } else {
      try {
        return new URL(href).pathname === listingPath || isEventGalleryListingUrl(href);
      } catch (error) {
        return false;
      }
    }
  }).filter((href, index, urls) => urls.indexOf(href) === index);
}

export function eventGalleryImagesFromHtml(html: string, pageUrl: string): ScrapedImage[] {
  const document = new JSDOM(html, {url: pageUrl}).window.document;
  const images = [...document.querySelectorAll("img")].map(image => {
    const src = eventGalleryDisplayUrl(image.getAttribute("data-src") || image.src || "");
    return {src, alt: (image.getAttribute("alt") || "").trim()};
  }).filter(image => IMAGE_HELPER.test(image.src) && !/blank\.gif/i.test(image.src) && !/width=160(?!\d)/.test(image.src));
  return images.filter((image, index) => images.findIndex(item => item.src === image.src) === index);
}

export function eventGalleryIndexImages(images: {src: string}[]): boolean {
  const folders = [...new Set(images.map(image => eventGalleryFolderFromUrl(image.src)).filter(Boolean))];
  return folders.length >= 3;
}
