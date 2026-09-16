import { ParentPageConfig } from "../models/migration-config.model";
import { SitemapNode } from "../models/sitemap.model";

export function migrationSectionKey(index: number, section: ParentPageConfig): string {
  return `section-${index}-${section?.pathPrefix || section?.url || "new"}`;
}

export function migrationSectionIndex(key: string): number {
  const index = Number((key || "").split("-")[1]);
  return Number.isInteger(index) ? index : -1;
}

export function migrationSectionNodes(sections: ParentPageConfig[], describe: (section: ParentPageConfig) => {title: string; detail: string}): SitemapNode[] {
  const nodes = (sections || []).map((section, index) => {
    const described = describe(section);
    return {key: migrationSectionKey(index, section), title: described.title, href: null as string, detail: described.detail, children: [] as SitemapNode[]};
  });
  const byPath = new Map((sections || []).reduce((found, section, index) => section.pathPrefix ? [...found, [section.pathPrefix, nodes[index]] as [string, SitemapNode]] : found, [] as [string, SitemapNode][]));
  const parentOf = (path: string): SitemapNode => {
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
    return !parentPath ? null : byPath.get(parentPath) || parentOf(parentPath);
  };
  return nodes.reduce((roots, node, index) => {
    const parent = parentOf((sections[index].pathPrefix || ""));
    if (parent && parent !== node) {
      parent.children = [...parent.children, node];
      return roots;
    } else {
      return [...roots, node];
    }
  }, [] as SitemapNode[]);
}
