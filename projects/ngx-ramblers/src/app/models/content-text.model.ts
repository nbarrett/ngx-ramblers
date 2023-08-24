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
}

export interface PageContentColumn extends Link, HasPageContentRows {
  columns?: number;
  contentTextId?: string;
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

export enum PageContentType {
  TEXT = "text",
  ACTION_BUTTONS = "action-buttons",
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

export enum InsertionPosition {
  BEFORE = "Before",
  AFTER = "After"
}

export interface ColumnInsertData {
  data: PageContentColumn;
  index: number;
}
