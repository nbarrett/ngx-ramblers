import { MigrationTemplateMapMapping, PageContentRow, PageContentType, LocationRowData } from "./content-text.model";
import { UIDateFormat } from "./date-format.model";

export enum TransformationActionType {
  CONVERT_TO_MARKDOWN = "convert-to-markdown",
  CREATE_PAGE = "create-page",
  CREATE_INDEX_PAGE = "create-index-page",
  ADD_ROW = "add-row",
  ADD_COLUMN = "add-column",
  ADD_NESTED_ROWS = "add-nested-rows",
  ADD_LOCATION_ROW = "add-location-row",
  ADD_INDEX_ROW = "add-index-row",
  ADD_MAP_ROW = "add-map-row",
  FIND_AND_ADD_TEXT = "find-and-add-text",
  FIND_AND_ADD_IMAGE = "find-and-add-image",
  SPLIT_TEXT_BY_IMAGES = "split-text-by-images",
  FILTER_CONTENT = "filter-content",
  ADD_MIGRATION_NOTE = "add-migration-note"
}

export enum ContentMatchType {
  HEADING = "heading",
  TEXT = "text",
  IMAGE = "image",
  ALL_CONTENT = "all-content",
  REMAINING = "remaining",
  COLLECT_WITH_BREAKS = "collect-with-breaks"
}

export enum TextMatchPattern {
  STARTS_WITH_HEADING = "starts-with-heading",
  PARAGRAPH = "paragraph",
  ALL_TEXT_UNTIL_IMAGE = "all-text-until-image",
  ALL_TEXT_AFTER_HEADING = "all-text-after-heading",
  CUSTOM_REGEX = "custom-regex",
  REMAINING_TEXT = "remaining-text",
  TEXT_BEFORE_HEADING = "text-before-heading",
  TEXT_FROM_HEADING = "text-from-heading",
  FIRST_HEADING_AND_CONTENT = "first-heading-and-content",
  HEADING_UNTIL_NEXT_HEADING = "heading-until-next-heading",
  CONTENT_AFTER_FIRST_HEADING = "content-after-first-heading",
  LEVEL_1_OR_2_HEADING = "level-1-or-2-heading"
}

export enum ImageMatchPattern {
  FILENAME_PATTERN = "filename-pattern",
  ALT_TEXT_PATTERN = "alt-text-pattern",
  FIRST_IMAGE = "first-image",
  ALL_IMAGES = "all-images",
  REMAINING_IMAGES = "remaining-images",
  PATTERN_MATCH = "pattern-match"
}

export enum SegmentType {
  TEXT = "text",
  IMAGE = "image",
  HEADING = "heading"
}

export interface StopCondition {
  onDetect: SegmentType[];
}

export interface ContentMatcher {
  type: ContentMatchType;
  textPattern?: TextMatchPattern;
  imagePattern?: ImageMatchPattern;
  customRegex?: string;
  headingPattern?: string;
  filenamePattern?: string;
  altTextPattern?: string;
  limit?: number;
  breakOnImage?: boolean;
  groupTextWithImage?: boolean;
  captionBeforeImage?: boolean;
  stopCondition?: StopCondition;
}

export interface NestedRowsConfig {
  contentMatcher: ContentMatcher;
  rowTemplate?: {
    type: PageContentType;
    maxColumns: number;
    showSwiper: boolean;
  };
  textRowTemplate?: {
    type: PageContentType;
    maxColumns: number;
    showSwiper: boolean;
  };
  imageRowTemplate?: {
    type: PageContentType;
    maxColumns: number;
    showSwiper: boolean;
  };
}

export type Mode = "none" | "dynamic" | "explicit";

export interface ColumnConfig {
  columns: number;
  content?: ContentMatcher;
  imageSource?: string;
  imageBorderRadius?: number;
  alt?: string;
  nestedRows?: NestedRowsConfig;
  rows?: RowConfig[];
}

export interface RowConfig {
  type: PageContentType;
  maxColumns: number;
  showSwiper: boolean;
  columns: ColumnConfig[];
  description?: string;
  marginTop?: number;
  marginBottom?: number;
  fragment?: {
    pageContentId: string;
  };
}

export interface LocationRowConfig {
  extractFromContent?: boolean;
  defaultLocation?: string;
  hidden?: boolean;
}

export interface IndexRowConfig {
  contentTypes?: string[];
  renderModes?: string[];
  contentPaths?: Array<{contentPath: string; stringMatch: string}>;
  minCols?: number;
  maxCols?: number;
  mapConfig?: {
    provider?: string;
    osStyle?: string;
    mapCenter?: [number, number];
    mapZoom?: number;
    height?: number;
    clusteringEnabled?: boolean;
    clusteringThreshold?: number;
    showControlsDefault?: boolean;
    allowControlsToggle?: boolean;
  };
}

export interface MapRowConfig {
  gpxFilePath?: string;
  extractFromContent?: boolean;
  height?: number;
  provider?: string;
  osStyle?: string;
}

export interface IndexPageConfig {
  path: string;
  title: string;
  indexConfig: IndexRowConfig;
}

export interface TransformationAction {
  type: TransformationActionType;
  targetRow?: number;
  targetColumn?: number;
  rowConfig?: RowConfig;
  columnConfig?: ColumnConfig;
  contentMatcher?: ContentMatcher;
  imageCaption?: string;
  showImageAfterText?: boolean;
  notePrefix?: string;
  dateFormat?: string;
  locationRowConfig?: LocationRowConfig;
  indexRowConfig?: IndexRowConfig;
  mapRowConfig?: MigrationTemplateMapMapping;
  indexPageConfig?: IndexPageConfig;
}

export interface PageTransformationConfig {
  name: string;
  description?: string;
  steps: TransformationAction[];
  enabled: boolean;
  preset?: string;
  excludePatterns?: string[] | string;
}

export interface TransformationContext {
  originalHtml: string;
  markdown: string;
  originalUrl?: string;
  segments: any[];
  rows: PageContentRow[];
  remainingText: string[];
  remainingImages: any[];
  usedTextIndices: Set<number>;
  usedImageIndices: Set<number>;
  mergedTextIndices?: Map<number, number[]>;
  excludePatterns?: string[] | string;
  extractedLocation?: LocationRowData;
  consumedCaptions?: Set<string>;
  extractedHeading?: string;
}

export function createDefaultTransformationConfig(): PageTransformationConfig {
  return {
    name: "Default Transformation",
    description: "Simple full-width text conversion",
    enabled: true,
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.ALL_CONTENT
              }
            }
          ]
        }
      }
      ,
      {
        type: TransformationActionType.ADD_MIGRATION_NOTE,
        notePrefix: "Migrated from",
        dateFormat: UIDateFormat.YEAR_MONTH_DAY_TIME_WITH_MINUTES
      }
    ]
  };
}

export function createTwoColumnWithImageTransformationConfig(): PageTransformationConfig {
  return {
    name: "Two Column with Featured Image",
    description: "Intro text with banner, then two columns with image and content, then remaining content after heading",
    enabled: true,
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Full-width intro with banner image",
          columns: [
            {
              columns: 12,
              nestedRows: {
                contentMatcher: {
                  type: ContentMatchType.COLLECT_WITH_BREAKS,
                  breakOnImage: true,
                  stopCondition: {
                    onDetect: [SegmentType.IMAGE]
                  }
                },
                rowTemplate: {
                  type: PageContentType.TEXT,
                  maxColumns: 1,
                  showSwiper: false
                }
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 2,
          showSwiper: false,
          description: "Two-column row: featured image on left (8 cols), content on right (4 cols) stopping at heading",
          columns: [
            {
              columns: 8,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.FIRST_IMAGE
              }
            },
            {
              columns: 4,
              nestedRows: {
                contentMatcher: {
                  type: ContentMatchType.COLLECT_WITH_BREAKS,
                  breakOnImage: true,
                  stopCondition: {
                    onDetect: [SegmentType.HEADING]
                  }
                },
                rowTemplate: {
                  type: PageContentType.TEXT,
                  maxColumns: 1,
                  showSwiper: false
                }
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Remaining content starting from heading",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.TEXT,
                textPattern: TextMatchPattern.REMAINING_TEXT
              }
            }
          ]
        }
      }
    ]
  };
}

export function createCustomRegexTransformationConfig(): PageTransformationConfig {
  return {
    name: "Custom Regex Extraction",
    description: "Use regex to match specific text patterns",
    enabled: true,
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Extract heading and intro paragraph using regex",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.TEXT,
                textPattern: TextMatchPattern.CUSTOM_REGEX,
                customRegex: "^###\\s+.+[\\s\\S]*?(?=###|$)"
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Remaining content",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.TEXT,
                textPattern: TextMatchPattern.REMAINING_TEXT
              }
            }
          ]
        }
      }
    ]
  };
}

export function createRouteMapLayoutTransformationConfig(): PageTransformationConfig {
  return {
    name: "Route Map Layout",
    description: "Show route map image specifically, with remaining images in gallery",
    enabled: true,
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 2,
          showSwiper: false,
          description: "Route map on left, intro text on right",
          columns: [
            {
              columns: 8,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.FILENAME_PATTERN,
                filenamePattern: "*route-map*"
              }
            },
            {
              columns: 4,
              content: {
                type: ContentMatchType.TEXT,
                textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 3,
          showSwiper: false,
          description: "Remaining images in 3-column gallery",
          columns: [
            {
              columns: 4,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.REMAINING_IMAGES
              }
            },
            {
              columns: 4,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.REMAINING_IMAGES
              }
            },
            {
              columns: 4,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.REMAINING_IMAGES
              }
            }
          ]
        }
      }
    ]
  };
}

export function createAllImagesLayoutTransformationConfig(): PageTransformationConfig {
  return {
    name: "All Images Layout",
    description: "Show all images in header carousel, then again with text",
    enabled: true,
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: true,
          description: "Image carousel at top showing all images",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.ALL_IMAGES
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "All remaining text content",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.TEXT,
                textPattern: TextMatchPattern.REMAINING_TEXT
              }
            }
          ]
        }
      }
    ]
  };
}

export function createWalkingRouteLayoutTransformationConfig(): PageTransformationConfig {
  return {
    name: "Walking Route Layout",
    description: "Walking route layout: banner image, heading, route map, two columns with nested content",
    enabled: true,
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Banner image at top",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.FIRST_IMAGE
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Page heading",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.HEADING
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Route map image with caption",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.IMAGE,
                imagePattern: ImageMatchPattern.FILENAME_PATTERN,
                filenamePattern: "*route*",
                groupTextWithImage: true
              },
              alt: "Map of route"
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 2,
          showSwiper: false,
          description: "Two columns: main content with paragraph and fragment (8) and sidebar (4)",
          columns: [
            {
              columns: 8,
              rows: [
                {
                  type: PageContentType.TEXT,
                  maxColumns: 1,
                  showSwiper: false,
                  columns: [
                    {
                      columns: 12,
                      content: {
                        type: ContentMatchType.TEXT,
                        textPattern: TextMatchPattern.PARAGRAPH,
                        limit: 1
                      }
                    }
                  ]
                },
                {
                  type: PageContentType.SHARED_FRAGMENT,
                  maxColumns: 1,
                  showSwiper: false,
                  columns: [],
                  fragment: {
                    pageContentId: ""
                  }
                }
              ]
            },
            {
              columns: 4,
              nestedRows: {
                contentMatcher: {
                  type: ContentMatchType.COLLECT_WITH_BREAKS,
                  breakOnImage: true,
                  groupTextWithImage: true,
                  imagePattern: ImageMatchPattern.FIRST_IMAGE,
                  stopCondition: {
                    onDetect: [SegmentType.HEADING]
                  }
                },
                textRowTemplate: {
                  type: PageContentType.TEXT,
                  maxColumns: 1,
                  showSwiper: false
                },
                imageRowTemplate: {
                  type: PageContentType.TEXT,
                  maxColumns: 1,
                  showSwiper: false
                }
              }
            }
          ]
        }
      }
    ]
  };
}


export function createRouteWithLocationTransformationConfig(): PageTransformationConfig {
  return {
    name: "Route with Location",
    description: "Create route page with intelligent location extraction and hidden Location row",
    enabled: true,
    preset: "routeWithLocation",
    steps: [
      {
        type: TransformationActionType.CONVERT_TO_MARKDOWN
      },
      {
        type: TransformationActionType.CREATE_PAGE
      },
      {
        type: TransformationActionType.ADD_LOCATION_ROW,
        locationRowConfig: {
          extractFromContent: true,
          hidden: true
        }
      },
      {
        type: TransformationActionType.ADD_ROW,
        rowConfig: {
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          description: "Full page content",
          columns: [
            {
              columns: 12,
              content: {
                type: ContentMatchType.ALL_CONTENT
              }
            }
          ]
        }
      },
      {
        type: TransformationActionType.ADD_MIGRATION_NOTE,
        notePrefix: "Migrated from",
        dateFormat: UIDateFormat.YEAR_MONTH_DAY_TIME_WITH_MINUTES
      }
    ]
  };
}

export function createRouteIndexTransformationConfig(): PageTransformationConfig {
  return {
    name: "Route Index with Map",
    description: "Create index page that displays routes on a map with action buttons",
    enabled: true,
    preset: "routeIndex",
    steps: [
      {
        type: TransformationActionType.CREATE_INDEX_PAGE,
        indexPageConfig: {
          path: "/routes",
          title: "Routes",
          indexConfig: {
            contentTypes: ["pages"],
            renderModes: ["map", "action-buttons"],
            contentPaths: [
              {
                contentPath: "routes/*",
                stringMatch: "contains"
              }
            ],
            minCols: 2,
            maxCols: 4,
            mapConfig: {
              provider: "osm",
              osStyle: "Leisure_27700",
              mapCenter: [51.25, 0.75],
              mapZoom: 10,
              height: 500,
              clusteringEnabled: true,
              clusteringThreshold: 10,
              showControlsDefault: true,
              allowControlsToggle: true
            }
          }
        }
      }
    ]
  };
}
