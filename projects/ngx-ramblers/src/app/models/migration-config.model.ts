import { Identifiable } from "./api-response.model";
import { PageTransformationConfig } from "./page-transformation.model";
import { PageContent } from "./content-text.model";

export enum ParentPageMode {
  AS_IS = "as-is",
  ACTION_BUTTONS = "action-buttons",
  INDEX = "index"
}

export interface PageLink {
  path: string;
  title: string;
  contentPath?: string;
}

export interface ParentPageConfig {
  selectedChildren?: PageLink[];
  migrateChildren?: boolean;
  url: string;
  pathPrefix: string;
  linkSelector?: string;
  migrateParent?: boolean;
  parentPageMode?: ParentPageMode | null;
  maxChildren?: number;
  pageTransformation?: PageTransformationConfig;
  templateFragmentId?: string;
}

export interface SiteMigrationConfig extends Identifiable {
  publicHtmlOnly?: boolean;
  requireSourceFidelity?: boolean;
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
  templateFragmentId?: string;
  templatePages?: PageContent[];
  useNestedRows?: boolean;
  persistData?: boolean;
  uploadTos3?: boolean;
  uploadBucket?: string;
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
