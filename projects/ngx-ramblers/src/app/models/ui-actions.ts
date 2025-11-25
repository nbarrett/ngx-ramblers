export enum ConfirmType {
  BULK_ACTION = "bulkAction",
  BULK_DELETE = "bulkDelete",
  CREATE_NEW = "createNew",
  DELETE = "delete",
  APPROVE = "approve",
  REQUEST_APPROVAL = "requestApproval",
  CANCEL = "cancel",
  CONTACT_OTHER = "contactOther",
  PUBLISH_MEETUP = "publishMeetup",
  SEND_NOTIFICATION = "sendNotification",
  CLEAR_WALK_LEADER = "clearWalkLeader",
  NONE = "none"
}

export enum EditMode {
  NONE = "None",
  ADD_NEW = "Add new",
  DELETE = "Delete",
  EDIT = "Edit existing",
  COPY_EXISTING = "Copy existing"
}

export enum StoredValue {
  ALBUM_TAB = "album-tab",
  AREA_MAP_CENTER = "area-map-center",
  AREA_MAP_CLICK_ACTION = "area-map-click-action",
  AREA_MAP_ZOOM = "area-map-zoom",
  AUTH_TOKEN = "auth-token",
  CAROUSEL = "carousel",
  CHART_TYPE = "agm-stats-chart-type",
  CONTENT_VIEW_MODE = "view-mode",
  EDIT_SITE = "edit-site",
  FROM_DATE = "from-date",
  GROUP_AREA_COLORS = "group-area-colors",
  GROUP_AREA_OPACITY_HOVER = "group-area-opacity-hover",
  GROUP_AREA_OPACITY_NORMAL = "group-area-opacity-normal",
  GROUP_AREA_TEXT_OPACITY = "group-area-text-opacity",
  MAP_AUTO_SHOW_ALL = "map-auto-show-all",
  MAP_HEIGHT = "map-height",
  MAP_OS_STYLE = "map-os-style",
  MAP_PROVIDER = "map-provider",
  MAP_SHOW_CONTROLS = "map-show-controls",
  MAP_SMOOTH_SCROLL = "map-smooth-scroll",
  MAP_ZOOM = "map-zoom",
  MARKDOWN_FIELD_HIDDEN = "markdown-field-hidden",
  PAGE = "page",
  REFRESH_TOKEN = "refresh-token",
  SEARCH = "search",
  SHOW_UNREFERENCED_PAGES = "show-unreferenced-pages",
  SOCIAL_DATE_CRITERIA = "social-date-criteria",
  SOCIAL_DATE_SORT = "social-date-sort",
  SOCIAL_QUICK_SEARCH = "social-quick-search",
  SORT = "sort",
  SORT_ORDER = "sort-order",
  STORY = "story",
  TAB = "tab",
  TO_DATE = "to-date",
  WALK_LIST_VIEW = "walk-list-view",
  WALK_SELECT_TYPE = "walk-select-type",
  WALK_SORT_ASC = "walk-sort-asc",
}

export enum LegacyStoredValue {
  AUTH_TOKEN = "AUTH_TOKEN",
  REFRESH_TOKEN = "REFRESH_TOKEN",
  EDIT_SITE = "editSite",
}

export class Confirm {
  private type: ConfirmType = ConfirmType.NONE;

  as(confirmType: ConfirmType) {
    this.type = confirmType;
  }

  toggleOnDeleteConfirm() {
    this.type = ConfirmType.DELETE;
  }

  clear() {
    this.type = ConfirmType.NONE;
  }

  noneOutstanding() {
    return this.type === ConfirmType.NONE;
  }

  bulkDeleteOutstanding() {
    return this.type === ConfirmType.BULK_DELETE;
  }

  bulkActionOutstanding() {
    return this.type === ConfirmType.BULK_ACTION;
  }

  notificationsOutstanding() {
    return this.type === ConfirmType.SEND_NOTIFICATION;
  }

  deleteConfirmOutstanding() {
    return this.type === ConfirmType.DELETE;
  }

  approveConfirmOutstanding() {
    return this.type === ConfirmType.APPROVE;
  }

  confirmType() {
    return this.type;
  }
}
