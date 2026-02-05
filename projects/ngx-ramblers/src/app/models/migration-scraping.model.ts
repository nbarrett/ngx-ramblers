import { ContentText, PageContent } from "./content-text.model";
import { ContentMetadata } from "./content-metadata.model";

export interface ScrapedImage {
  src: string;
  alt: string;
}

export interface ScrapedSegment {
  text: string;
  image?: ScrapedImage;
}

export interface ScrapedPage {
  path: string;
  title: string;
  segments: ScrapedSegment[];
  firstImage?: ScrapedImage;
}

export interface MigratedAlbum {
  album: ContentMetadata;
  pageContent: PageContent;
}

export interface MigrationResult {
  pageContents: PageContent[];
  contentTextItems: ContentText[];
  albums: MigratedAlbum[];
}

export interface ReconciliationConfig {
  oldSiteUrl: string;
  newSiteUrl: string;
  username?: string;
  password?: string;
  dryRun: boolean;
}

export interface ReconciliationPage {
  path: string;
  url: string;
  title: string;
  type: string;
  textContent: string;
  markdown: string;
  images: string[];
  links: string[];
}

export interface NgxPage {
  id: string;
  path: string;
  rows: any[];
}

export interface NgxWalkGroupEvent {
  title?: string;
  start_date_time?: string;
  end_date_time?: string;
  description?: string;
  distance_miles?: number;
  difficulty?: { code: string; description: string };
  start_location?: { latitude: number; longitude: number; postcode?: string };
}

export interface NgxWalk {
  id: string;
  title: string;
  eventDate: string;
  briefDescriptionAndStartPoint?: string;
  groupEvent?: NgxWalkGroupEvent;
}

export type GapType = "page" | "content" | "album";
export type GapPriority = "high" | "medium" | "low";

export interface ReconciliationGap {
  type: GapType;
  oldPath: string;
  description: string;
  priority: GapPriority;
}

export type SuggestionAction = "create" | "update";

export interface ReconciliationSuggestion {
  action: SuggestionAction;
  path: string;
  description: string;
  content?: any;
}

export interface ReconciliationResult {
  oldPages: ReconciliationPage[];
  newPages: NgxPage[];
  walks: NgxWalk[];
  gaps: ReconciliationGap[];
  suggestions: ReconciliationSuggestion[];
}

