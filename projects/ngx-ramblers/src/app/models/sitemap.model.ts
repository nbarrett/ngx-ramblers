export interface SitemapNode {
  key: string;
  title: string;
  href: string | null;
  selected?: boolean;
  detail?: string;
  children: SitemapNode[];
}

export enum SiteMapViewMode {
  SECTIONS = "sections",
  TREE = "tree"
}

export enum SitemapMoveDirection {
  UP = -1,
  DOWN = 1
}

export function sitemapHrefIsExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}
