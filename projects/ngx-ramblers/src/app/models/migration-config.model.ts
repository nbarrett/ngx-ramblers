import { Identifiable } from "./api-response.model";
import { PageTransformationConfig } from "./page-transformation.model";

export interface PageLink {
  path: string;
  title: string;
  contentPath?: string;
}

export interface ParentPageConfig {
  url: string;
  pathPrefix: string;
  linkSelector?: string;
  migrateParent?: boolean;
  parentPageMode?: "as-is" | "action-buttons";
  maxChildren?: number;
  pageTransformation?: PageTransformationConfig;
}

export interface SiteMigrationConfig extends Identifiable {
  expanded: boolean;
  name: string;
  baseUrl: string;
  siteIdentifier: string;
  menuSelector: string;
  contentSelector: string;
  galleryPath?: string;
  gallerySelector?: string;
  galleryImagePath?: string;
  specificAlbums?: PageLink[];
  parentPages?: ParentPageConfig[];
  useNestedRows?: boolean;
  persistData?: boolean;
  uploadTos3?: boolean;
  enabled?: boolean;
  excludeSelectors?: string[] | string;
  excludeTextPatterns?: string[] | string;
  excludeMarkdownBlocks?: string;
  excludeImageUrls?: string[] | string;
  defaultPageTransformation?: PageTransformationConfig;
}

export interface ExclusionsConfig {
  excludeTextPatterns?: string[] | string;
  excludeMarkdownBlocks?: string[] | string;
  excludeImageUrls?: string[] | string;
}

export interface MigrationConfig {
  sites: SiteMigrationConfig[];
}
