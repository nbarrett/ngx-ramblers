import { ApiResponse } from "./api-response.model";
import { AccessLevel } from "./member-resource.model";
import { Link } from "./page.model";
import { BezierEasingOptions } from "ng-gallery/lib/smooth-scroll";

export interface ContentText {
  id?: string;
  category?: string;
  name?: string;
  text?: string;
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

export interface PageContentRow {
  type: PageContentType;
  maxColumns: number;
  showSwiper: boolean;
  columns: PageContentColumn[];
  marginTop?: number;
  marginBottom?: number;
  carousel?: AlbumData;
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
  albums: string[];
  columns?: number;
}

export enum PageContentType {
  ACTION_BUTTONS = "action-buttons",
  ALBUM = "album",
  ALBUM_INDEX = "album-index",
  CAROUSEL = "carousel",
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
