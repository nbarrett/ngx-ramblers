import { ApiResponse } from "./api-response.model";
import { AccessLevel } from "./member-resource.model";
import { Link } from "./page.model";

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
  title: string;
  name: string;
  albumView: AlbumView;
  allowSwitchView: boolean;
  eventId: string;
  eventType: string;
  createdAt: number;
  createdBy: string;
  slideInterval: number;
  showIndicators: boolean;
  showStoryNavigator: boolean;
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

export enum InsertionPosition {
  BEFORE = "Before",
  AFTER = "After"
}

export interface ColumnInsertData {
  data: PageContentColumn;
  index: number;
}
