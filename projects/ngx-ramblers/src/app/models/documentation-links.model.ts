export const DOCUMENTATION_SITE_PLACEHOLDER = "{{siteUrl}}";
export const DOCUMENTATION_SITE_SELECTOR_ID = "documentation-site-selector";

export interface DocumentationSite {
  name: string;
  label: string;
  url: string;
}

export interface DocumentationLinkChange {
  field: string;
  before: string;
  after: string;
}

export interface DocumentationPageChange {
  id: string;
  path: string;
  changes: DocumentationLinkChange[];
}

export interface DocumentationLinkSweepOptions {
  url: string;
  report: string;
  apply?: boolean;
}

export interface DocumentationMenuLink {
  label: string;
  path: string;
}

export interface DocumentationSweepContext {
  origins: string[];
  menuLinks: DocumentationMenuLink[];
  url?: string;
}

export interface DocumentationSweepReport {
  url: string;
  pagesScanned: number;
  changes: DocumentationPageChange[];
  unresolved: DocumentationLinkChange[];
}

export enum LegacyDocumentationTab {
  AREA_MAP_DATA = "area-map-data",
  CAMPAIGN_QUEUE = "campaign-queue",
  GROUP_DETAILS = "group-details"
}
