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
  ACCESSIBILITY = "accessibility",
  ALBUM_TAB = "album-tab",
  AREA_MAP_CENTER = "area-map-center",
  AREA_MAP_CLICK_ACTION = "area-map-click-action",
  AREA_MAP_ZOOM = "area-map-zoom",
  AUTH_TOKEN = "auth-token",
  CANCELLED = "cancelled",
  CAROUSEL = "carousel",
  CHART_TYPE = "agm-stats-chart-type",
  CONTENT_TEMPLATE_VIEW = "content-template-view",
  CONTENT_VIEW_MODE = "view-mode",
  DATE_FROM = "date-from",
  DATE_TO = "date-to",
  DAYS_OF_WEEK = "days-of-week",
  DIFFICULTY = "difficulty",
  DISTANCE_MAX = "distance-max",
  DISTANCE_MIN = "distance-min",
  EDIT_SITE = "edit-site",
  FACILITIES = "facilities",
  FREE_ONLY = "free-only",
  GROUP_AREA_COLORS = "group-area-colors",
  GROUP_AREA_OPACITY_HOVER = "group-area-opacity-hover",
  GROUP_AREA_OPACITY_NORMAL = "group-area-opacity-normal",
  GROUP_AREA_TEXT_OPACITY = "group-area-text-opacity",
  GROUP_CODES = "group-codes",
  LEADERS = "leaders",
  LOCATION_METHOD = "location-method",
  MAP_AUTO_SHOW_ALL = "map-auto-show-all",
  MAP_HEIGHT = "map-height",
  MAP_OS_STYLE = "map-os-style",
  MAP_PROVIDER = "map-provider",
  MAP_SHOW_CONTROLS = "map-show-controls",
  MAP_SMOOTH_SCROLL = "map-smooth-scroll",
  MAP_ZOOM = "map-zoom",
  MARKDOWN_FIELD_HIDDEN = "markdown-field-hidden",
  MIGRATION_MAP_EXTRACT_FROM_CONTENT = "migration-map-extract-from-content",
  MIGRATION_SITE_EXPANDED = "migration-site-expanded",
  MIGRATION_TEMPLATE_MAPPING_MODE = "migration-template-mapping-mode",
  PAGE = "page",
  PROXIMITY_LAT = "proximity-lat",
  PROXIMITY_LNG = "proximity-lng",
  PROXIMITY_RADIUS = "proximity-radius",
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
  TEMPLATE_OPTIONS_VISIBLE = "template-options-visible",
  WALK_LIST_VIEW = "walk-list-view",
  WALK_SELECT_TYPE = "walk-select-type",
  WALK_SORT_ASC = "walk-sort-asc",
}

export enum WalkEditTab {
  MAIN_DETAILS = "Main Details",
  WALK_DETAILS = "Walk Details",
  RISK_ASSESSMENT = "Risk Assessment",
  RELATED_LINKS = "Related Links",
  LEADER = "Leader",
  FEATURES = "Features",
  IMAGES = "Images",
  HISTORY = "History",
  COPY = "Copy...",
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
