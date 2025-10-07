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

