import { ApiResponse } from "./api-response.model";
import { AccessLevel } from "./member-resource.model";
import { Link } from "./page.model";
import { BezierEasingOptions } from "ng-gallery/lib/smooth-scroll";
import { fieldContainsValue, fieldEqualsValue, fieldStartsWithValue, MongoRegex } from "../functions/mongo";
import { HasClass } from "./banner-configuration.model";
import { EventsData } from "./social-events.model";

export enum ContentTextCategory {
  MEETUP_DESCRIPTION_PREFIX = "meetup-description-prefix"
}

export enum StringMatch {
  EQUALS = "equals",
  STARTS_WITH = "starts-with",
  CONTAINS = "contains"
}

export enum ListStyle {
  ARROW = "arrow",
  NO_IMAGE = "no-image",
  TICK_LARGE = "tick-large",
  TICK_MEDIUM = "tick-medium",
}

export interface ContentText {
  id?: string;
  category?: string;
  name?: string;
  text?: string;
  styles?: ContentTextStyles;
}

export interface ContentTextStyles extends HasClass {
  list?: ListStyle;
}

export interface ContentTextApiResponse extends ApiResponse {
  request: any;
  response?: ContentText | ContentText[];
}

export interface HasPageContentRows {
  rows?: PageContentRow[];
}

export interface PageContent extends HasPageContentRows {
  id?: string;
  path?: string;
}

export interface PageContentToRows {
  pageContent: PageContent;
  rows?: PageContentRow[];
}

export interface PageContentApiResponse extends ApiResponse {
  request: any;
  response?: PageContent | PageContent[];
}

export interface PageContentRow {
  type: PageContentType;
  maxColumns: number;
  showSwiper: boolean;
  columns: PageContentColumn[];
  marginTop?: number;
  marginBottom?: number;
  carousel?: AlbumData;
  events?: EventsData;
  albumIndex?: AlbumIndex;
}

export interface PageContentColumn extends Link, HasPageContentRows {
  columns?: number;
  contentTextId?: string;
  contentText?: string;
  imageSource?: string;
  imageBorderRadius?: number;
  icon?: string;
  accessLevel?: AccessLevel;
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

export interface AlbumIndex {
  contentPaths: ContentPathMatch[];
}

export enum PageContentPath {
  ADMIN_ACTION_BUTTONS = "admin#action-buttons",
  COMMITTEE_ACTION_BUTTONS_YEARS = "committee#committee-years"
}

export enum PageContentType {
  ACTION_BUTTONS = "action-buttons",
  ALBUM = "album",
  ALBUM_INDEX = "album-index",
  CAROUSEL = "carousel",
  EVENTS = "events",
  TEXT = "text",
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
  COPY = "Copy"
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
  thumbDetached?: boolean;
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
