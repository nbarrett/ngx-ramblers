import { ApiResponse } from "./api-response.model";
import { AccessLevel } from "./member-resource.model";
import { Link } from "./page.model";
import { BezierEasingOptions } from "ng-gallery/lib/smooth-scroll";
import { fieldContainsValue, fieldEqualsValue, fieldStartsWithValue, MongoRegex } from "../functions/mongo";
import { HasClass } from "./banner-configuration.model";
import { EventsData } from "./social-events.model";
import { DescribedDimensions, FileNameData } from "./aws-object.model";
import { HasNgSelectAttributes, LocationDetails } from "./ramblers-walks-manager";

export const EM_DASH = " — ";
export const EM_DASH_WITH_SPACES = ` ${EM_DASH} `;

export enum ContentTextCategory {
  MEETUP_DESCRIPTION_PREFIX = "meetup-description-prefix"
}

export enum StringMatch {
  EQUALS = "equals",
  STARTS_WITH = "starts-with",
  CONTAINS = "contains"
}

export enum IndexContentType {
  ALBUMS = "albums",
  PAGES = "pages"
}

export enum IndexRenderMode {
  ACTION_BUTTONS = "action-buttons",
  MAP = "map"
}

export enum LocationRenderingMode {
  HIDDEN = "hidden",
  VISIBLE = "visible"
}

export interface LocationRowData {
  start: LocationDetails;
  end?: LocationDetails;
  renderingMode: LocationRenderingMode;
}

export enum ListStyle {
  NO_IMAGE = "no-image",
  ARROW = "arrow",
  TICK_LARGE = "tick-large",
  TICK_MEDIUM = "tick-medium",
}

export enum LinkStyle {
  BOLD = "markdown-link-default-bold",
  NORMAL = "markdown-link-default-normal",
  PINK = "markdown-link-pink",
  GREEN = "markdown-link-green",
}

export interface ListStyleMapping {
  key: ListStyle;
  class: string;
}

export const ListStyleMappings: { [key in ListStyle]: string } = {
  [ListStyle.NO_IMAGE]: "list-default",
  [ListStyle.ARROW]: "list-arrow",
  [ListStyle.TICK_LARGE]: "list-tick-large",
  [ListStyle.TICK_MEDIUM]: "list-tick-medium",
};

export interface SplitEvent {
  textBefore: string;
  textAfter: string;
  additionalRows?: string[];
  createNested?: boolean;
}

export interface ContentText {
  id?: string;
  category?: string;
  name?: string;
  text?: string;
  styles?: ContentTextStyles;
}

export interface HasStyles {
  list?: ListStyle;
  link?: LinkStyle;
}

export interface ContentTextStyles extends HasStyles, HasClass {
  list?: ListStyle;
}

export interface ContentTextApiResponse extends ApiResponse {
  request: any;
  response?: ContentText | ContentText[];
}

export interface HasPageContentRows {
  rows?: PageContentRow[];
}

export interface HasColumnRange {
  minColumns?: number;
  maxColumns: number;
}

export interface PageContent extends HasPageContentRows {
  id?: string;
  path?: string;
  migrationTemplate?: MigrationTemplateMetadata;
  debugLogs?: string[];
}

export interface PageContentToRows {
  pageContent: PageContent;
  rows?: PageContentRow[];
}

export interface PageContentApiResponse extends ApiResponse {
  request: any;
  response?: ContentText | ContentText[];
}

export enum AreaMapClickAction {
  GROUP_WEBSITE = "group-website",
  FILTER_WALKS = "filter-walks"
}

export interface AreaMapData {
  region?: string;
  title?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  mapHeight?: number;
  showControls?: boolean;
  selectedGroups?: string[];
  clickAction?: AreaMapClickAction;
  opacityNormal?: number;
  opacityHover?: number;
  textOpacity?: number;
  provider?: string;
  osStyle?: string;
  areaColors?: Record<string, string>;
}

export interface MapRoute {
  id: string;
  name: string;
  gpxFile?: FileNameData;
  color?: string;
  visible?: boolean;
  weight?: number;
  opacity?: number;
}

export interface MapMarker {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface MapData {
  text?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  mapHeight?: number;
  useLocationFromPage?: boolean;
  provider?: string;
  osStyle?: string;
  showControlsDefault?: boolean;
  allowControlsToggle?: boolean;
  showWaypointsDefault?: boolean;
  allowWaypointsToggle?: boolean;
  autoFitBounds?: boolean;
  routes: MapRoute[];
  markers?: MapMarker[];
}

export interface PageContentRow extends HasColumnRange {
  type: PageContentType;
  showSwiper: boolean;
  columns: PageContentColumn[];
  marginTop?: number;
  marginBottom?: number;
  carousel?: AlbumData;
  events?: EventsData;
  albumIndex?: Index;
  areaMap?: AreaMapData;
  map?: MapData;
  fragment?: Fragment;
  location?: LocationRowData;
  migrationPlaceholder?: boolean;
  hidden?: boolean;
}

export interface PageContentColumn extends Link, HasPageContentRows {
  columns?: number;
  contentText?: string;
  imageSource?: string;
  alt?: string;
  imageBorderRadius?: number;
  icon?: string;
  accessLevel?: AccessLevel;
  showPlaceholderImage?: boolean;
  showTextAfterImage?: boolean;
  imageAspectRatio?: DescribedDimensions;
  styles?: ContentTextStyles;
  location?: LocationDetails;
}

export enum MigrationTemplateSourceType {
  EXTRACT = "extract",
  STATIC = "static",
  METADATA = "metadata"
}

export enum ContentTemplateType {
  SHARED_FRAGMENT = "shared-fragment",
  USER_TEMPLATE = "user-template",
  MIGRATION_TEMPLATE = "migration-template"
}

export interface MigrationTemplateLocationMapping {
  extractFromContent?: boolean;
  hideRow?: boolean;
  defaultLocation?: string;
}

export interface MigrationTemplateMapMapping {
  extractGpxFromContent?: boolean;
  gpxFilePath?: string;
  useLocationFromRow?: boolean;
  height?: number;
  provider?: string;
  osStyle?: string;
  extractFromContent?: boolean;
}

export interface MigrationTemplateIndexMapping {
  useStaticConfig?: boolean;
}

export enum NestedRowContentSource {
  REMAINING_IMAGES = "remaining-images",
  REMAINING_TEXT = "remaining-text",
  ALL_CONTENT = "all-content",
  ALL_IMAGES = "all-images",
  PATTERN_MATCH = "pattern-match"
}

export enum NestedRowPackingBehavior {
  ONE_PER_ITEM = "one-per-item",
  ALL_IN_ONE = "all-in-one",
  COLLECT_WITH_BREAKS = "collect-with-breaks"
}

export enum BreakStopCondition {
  IMAGE = "image",
  HEADING = "heading",
  PARAGRAPH = "paragraph"
}

export interface NestedRowMappingConfig {
  contentSource: NestedRowContentSource;
  packingBehavior: NestedRowPackingBehavior;
  breakOn?: BreakStopCondition;
  stopOn?: BreakStopCondition;
  groupTextWithImage?: boolean;
  filenamePattern?: string;
  textPattern?: string;
  customTextPattern?: string;
  imagePattern?: string;
  headingPattern?: string;
}

export enum ColumnContentType {
  IMAGE = "image",
  TEXT = "text",
  MIXED = "mixed"
}

export enum ImagePattern {
  FIRST = "first",
  LAST = "last",
  ALL = "all",
  PATTERN_MATCH = "pattern-match"
}

export interface ColumnMappingContext {
  rowIndex: number;
  columnIndex: number;
  nestedRowIndex?: number;
  nestedColumnIndex?: number;
}

export interface ColumnMappingConfig {
  columnIndex: number;
  nestedRowIndex?: number;
  nestedColumnIndex?: number;
  sourceType?: MigrationTemplateSourceType;
  extractPreset?: string;
  extractPattern?: string;
  textPattern?: string;
  contentType?: ColumnContentType;
  imagePattern?: ImagePattern;
  imagePatternValue?: string;
  groupShortTextWithImage?: boolean;
  captionBeforeImage?: boolean;
  nestedRowMapping?: NestedRowMappingConfig;
  targetNestedRowIndex?: number;
  targetNestedColumnIndex?: number;
}

export interface MigrationTemplateMapping {
  targetRowIndex: number;
  targetColumnIndex?: number;
  targetNestedRowIndex?: number;
  targetNestedColumnIndex?: number;
  sourceType?: MigrationTemplateSourceType;
  sourceIdentifier?: string;
  metadataPrefix?: string;
  metadataDateFormat?: string;
  extractPreset?: string;
  extractPattern?: string;
  textPattern?: string;
  location?: MigrationTemplateLocationMapping;
  map?: MigrationTemplateMapMapping;
  index?: MigrationTemplateIndexMapping;
  columnMappings?: ColumnMappingConfig[];
  hideIfEmpty?: boolean;
  excludePatterns?: string[] | string;
  notes?: string;
}

export interface MigrationTemplateMetadata {
  isTemplate?: boolean;
  templateType?: ContentTemplateType;
  templateName?: string;
  templateDescription?: string;
  mappings?: MigrationTemplateMapping[];
  fragmentId?: string;
  fragmentPath?: string;
}

export interface PageContentEditEvent {
  columnIndex: number;
  rowIndex: number;
  path: string;
  image?: string;
  editActive?: boolean;
}

export interface AlbumPath {
  albumName: string;
  contentPath: string;
}

export interface AlbumData {
  name: string;
  title: string;
  subtitle: any;
  showTitle: boolean;
  showCoverImageAndText: boolean;
  introductoryText: string;
  coverImageHeight: number;
  coverImageBorderRadius: number;
  showPreAlbumText: boolean;
  preAlbumText: string;
  albumView: AlbumView;
  gridViewOptions: GridViewOptions;
  galleryViewOptions: GalleryViewOptions;
  allowSwitchView: boolean;
  eventId: string;
  eventDate: number;
  eventType: string;
  createdAt: number;
  createdBy: string;
  slideInterval: number;
  showIndicators: boolean;
  showStoryNavigator: boolean;
  height: number;
}

export interface IndexMapConfig {
  height?: number;
  clusteringEnabled?: boolean;
  clusteringThreshold?: number;
  provider?: string;
  osStyle?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  showControlsDefault?: boolean;
  allowControlsToggle?: boolean;
}

export interface Index {
  contentPaths: ContentPathMatch[];
  contentTypes?: IndexContentType[];
  renderModes?: IndexRenderMode[];
  mapConfig?: IndexMapConfig;
  minCols?: number;
  maxCols?: number;
}

export enum BuiltInAnchor {
  ACTION_BUTTONS = "action-buttons",
  COMMITTEE_YEARS = "committee-years",
  HOME_CONTENT = "home-content",
  INSTAGRAM_CONTENT = "instagram-content",
  PAGE_HEADER = "page-header",
  SOCIAL_CONTENT = "social-content",
}

export enum BuiltInPath {
  ADMIN = "admin",
  COMMITTEE = "committee",
  HOME = "home",
  WALKS = "walks",
}

export interface BuiltInPageContentConfig {
  contentPath: string;
  anchors: BuiltInAnchor[];
}

export const BuiltInContentConfigs: { [key in BuiltInPath]: BuiltInPageContentConfig } = {
  [BuiltInPath.HOME]: {
    contentPath: BuiltInPath.ADMIN,
    anchors: [BuiltInAnchor.HOME_CONTENT, BuiltInAnchor.INSTAGRAM_CONTENT]
  },
  [BuiltInPath.ADMIN]: {
    contentPath: BuiltInPath.ADMIN,
    anchors: [BuiltInAnchor.ACTION_BUTTONS]
  },
  [BuiltInPath.COMMITTEE]: {
    contentPath: BuiltInPath.COMMITTEE,
    anchors: [BuiltInAnchor.ACTION_BUTTONS, BuiltInAnchor.COMMITTEE_YEARS]
  },
  [BuiltInPath.WALKS]: {
    contentPath: BuiltInPath.WALKS,
    anchors: [BuiltInAnchor.PAGE_HEADER, BuiltInAnchor.ACTION_BUTTONS]
  }
};

export enum PageContentPath {
  ADMIN_ACTION_BUTTONS = `${BuiltInPath.ADMIN}#${BuiltInAnchor.ACTION_BUTTONS}`,
  COMMITTEE_ACTION_BUTTONS_YEARS = `${BuiltInPath.COMMITTEE}#${BuiltInAnchor.COMMITTEE_YEARS}`,
}

export enum PageContentType {
  ACTION_BUTTONS = "action-buttons",
  ALBUM = "album",
  ALBUM_INDEX = "album-index",
  CAROUSEL = "carousel",
  EVENTS = "events",
  AREA_MAP = "area-map",
  MAP = "map",
  TEXT = "text",
  SHARED_FRAGMENT = "shared-fragment",
  LOCATION = "location",
}

export enum ImageType {
  ERROR = "error",
  MISSING = "missing",
  IMAGE = "image",
  ICON = "icon",
}

export enum View {
  EDIT = "edit",
  VIEW = "view"
}

export interface EditorState {
  view: View;
  dataAction: DataAction;
}

export interface ContentPathMatch {
  contentPath: string;
  stringMatch: StringMatch;
}

type MongoRegexFunction = (fieldValue: string) => MongoRegex;

export interface ContentPathMatchConfig {
  mongoRegex: MongoRegexFunction;
}

export const ContentPathMatchConfigs: { [key in StringMatch]: ContentPathMatchConfig } = {
  [StringMatch.CONTAINS]: {mongoRegex: fieldContainsValue},
  [StringMatch.STARTS_WITH]: {mongoRegex: fieldStartsWithValue},
  [StringMatch.EQUALS]: {mongoRegex: fieldEqualsValue},
};

export interface EditorInstanceState {
  view: View;
  instance: object;
}

export enum DataAction {
  QUERY = "query",
  SAVE = "save",
  REVERT = "revert",
  NONE = "none"
}

export enum ActionType {
  ROW = "row",
  COLUMN = "column",
  NESTED_ROW = "nested-row",
  NESTED_COLUMN = "nested-column",
  UNKNOWN = "unknown"
}

export interface Margin {
  value: number;
  description: string;
}

export interface InsertionRow {
  index: number;
  description: string;
}

export enum Action {
  MOVE = "Move",
  COPY = "Copy",
  CREATE_FRAGMENT = "Create Named Fragment"
}

export interface Fragment {
  pageContentId: string;
}

export interface FragmentWithLabel extends Fragment, HasNgSelectAttributes {
}

export enum AlbumView {
  CAROUSEL = "carousel",
  GALLERY = "gallery",
  GRID = "grid",
}

export interface GridViewOptions {
  showTitles: boolean;
  showDates: boolean;
}

export interface GalleryViewOptions {
  nav?: boolean;
  dots?: boolean;
  loop?: boolean;
  debug?: boolean;
  thumb?: boolean;
  counter?: boolean;
  dotsSize?: number;
  autoPlay?: boolean;
  thumbWidth?: number;
  thumbHeight?: number;
  disableThumb?: boolean;
  scrollBehavior?: ScrollBehavior;
  navScrollBehavior?: ScrollBehavior;
  slidingDisabled?: boolean;
  thumbSlidingDisabled?: boolean;
  mouseSlidingDisabled?: boolean;
  thumbMouseSlidingDisabled?: boolean;
  playerInterval?: number;
  slidingDuration?: number;
  slidingEase?: BezierEasingOptions;
  resizeDebounceTime?: number;
  imageSize?: "cover" | "contain";
  thumbImageSize?: "cover" | "contain";
  dotsPosition?: "top" | "bottom";
  counterPosition?: "top" | "bottom";
  slidingDirection?: "horizontal" | "vertical";
  loadingAttr?: "eager" | "lazy";
  loadingStrategy?: "preload" | "lazy" | "default";
  thumbPosition?: "top" | "left" | "right" | "bottom";
  thumbView?: "default" | "contain";
  thumbAutosize?: boolean;
  itemAutosize?: boolean;
  autoHeight?: boolean;
}

export enum InsertionPosition {
  BEFORE = "Before",
  AFTER = "After"
}

export interface ColumnInsertData {
  type: PageContentType;
  data: PageContentColumn;
  index: number;
}

export const DEFAULT_GALLERY_OPTIONS: GalleryViewOptions = {
  thumbPosition: "left",
  imageSize: "cover",
  thumbImageSize: "cover",
  loadingStrategy: "lazy",
  dotsPosition: "bottom"
};

export const DEFAULT_GRID_OPTIONS = {showTitles: true, showDates: true};


export interface PageContentGroup {
  path: string;
  pageContents: PageContent[];
}

export interface DuplicatePageContent extends PageContentGroup {
  duplicatePageContents: PageContent[];
}

export interface Transformation {
  template: {
    type: PageContentType;
    maxColumns: number;
    showSwiper: boolean;
  };
  contentText: string;
}
