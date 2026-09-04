export const RELEASE_FEED_TYPE = "release-feed";

export interface ReleaseFeedEntry {
  title: string;
  path: string;
  url: string;
  markdownUrl: string;
  jsonUrl: string;
  htmlUrl: string;
  hasImages: boolean;
}

export interface ReleaseFeed {
  title: string;
  description: string;
  type: typeof RELEASE_FEED_TYPE;
  generated: string;
  indexPath: string;
  indexUrl: string;
  humansIndexPath: string | null;
  humansIndexUrl: string | null;
  entries: ReleaseFeedEntry[];
}
