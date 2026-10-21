import { JSDOM } from "jsdom";

export enum DiscoveredSocialNetwork {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  TWITTER = "twitter",
  YOUTUBE = "youtube",
  MEETUP = "meetup",
  LINKED_IN = "linkedIn"
}

export interface DiscoveredSocialLink {
  network: DiscoveredSocialNetwork;
  url: string;
}

const SHARE_PATH = /\/sharer|\/share|\/intent\/|\/dialog\//i;

function networkForHost(host: string): DiscoveredSocialNetwork | null {
  if (/(^|\.)facebook\.com$/.test(host) || /(^|\.)fb\.com$/.test(host)) {
    return DiscoveredSocialNetwork.FACEBOOK;
  } else if (/(^|\.)instagram\.com$/.test(host)) {
    return DiscoveredSocialNetwork.INSTAGRAM;
  } else if (/(^|\.)twitter\.com$/.test(host) || /(^|\.)x\.com$/.test(host)) {
    return DiscoveredSocialNetwork.TWITTER;
  } else if (/(^|\.)youtube\.com$/.test(host) || /(^|\.)youtu\.be$/.test(host)) {
    return DiscoveredSocialNetwork.YOUTUBE;
  } else if (/(^|\.)meetup\.com$/.test(host)) {
    return DiscoveredSocialNetwork.MEETUP;
  } else if (/(^|\.)linkedin\.com$/.test(host)) {
    return DiscoveredSocialNetwork.LINKED_IN;
  } else {
    return null;
  }
}

export function socialLinksFromHtml(html: string, pageUrl = "https://group.example.org.uk/"): DiscoveredSocialLink[] {
  const document = new JSDOM(html || "", {url: pageUrl}).window.document;
  return [...document.querySelectorAll("a[href]")].reduce((found, anchor) => {
    try {
      const url = new URL((anchor as HTMLAnchorElement).href, pageUrl);
      const network = networkForHost(url.hostname.replace(/^www\./, ""));
      return network && !SHARE_PATH.test(url.pathname) && !found.some(item => item.network === network)
        ? [...found, {network, url: url.href}]
        : found;
    } catch (error) {
      return found;
    }
  }, [] as DiscoveredSocialLink[]);
}

export function socialConfigUpdates(links: DiscoveredSocialLink[]): Record<string, unknown> {
  return links.reduce((updates, link) => ({
    ...updates,
    [`value.externalSystems.${link.network}.groupUrl`]: link.url,
    [`value.externalSystems.${link.network}.showFooterLink`]: true
  }), {} as Record<string, unknown>);
}
