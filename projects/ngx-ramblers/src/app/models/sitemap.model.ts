export interface SitemapNode {
  key: string;
  title: string;
  href: string | null;
  children: SitemapNode[];
}
