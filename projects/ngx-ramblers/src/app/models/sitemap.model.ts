export interface SitemapNode {
  key: string;
  title: string;
  href: string | null;
  children: SitemapNode[];
}

export enum SiteMapViewMode {
  SECTIONS = "sections",
  TREE = "tree"
}
