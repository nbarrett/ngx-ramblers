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
  ADD_PHOTOS = "add-photos",
  ALBUM_COPY_DESTINATIONS = "album-copy-destinations",
  ADVANCED_SEARCH = "advanced-search",
  ALBUM_TAB = "album-tab",
  ALBUM_VIEW = "album-view",
  ALBUM_WORKFLOW = "album-workflow",
  ANALYTICS_RANGE = "analytics-range",
  APP = "app",
  AREA_MAP_CENTER = "area-map-center",
  AREA_MAP_CLICK_ACTION = "area-map-click-action",
  AREA_MAP_ZOOM = "area-map-zoom",
  AS = "as",
  AUDIT_MESSAGE = "audit-message",
  AUDIT_TIME = "audit-time",
  AUTH_TOKEN = "auth-token",
  BANNER = "banner",
  BRANDING = "branding",
  BREVO_SECTION = "brevo-section",
  CALENDAR_COLOUR_BY = "calendar-colour-by",
  CALENDAR_DATE = "calendar-date",
  CALENDAR_VIEW = "calendar-view",
  CAMPAIGN_END_DATE = "endDate",
  CAMPAIGN_EVENT_TYPE = "eventType",
  CAMPAIGN_ID = "campaignId",
  CAMPAIGN_START_DATE = "startDate",
  CANCELLED = "cancelled",
  CAROUSEL = "carousel",
  CHART_TYPE = "chart-type",
  COLOUR_PALETTE = "colour-palette",
  COMMITTEE_FILE = "committee-file",
  CONFIDENCE = "confidence",
  CONFIGURATION = "configuration",
  CONFIGURED = "configured",
  CONFIG_ID = "config-id",
  CONNECTED = "connected",
  CONSOLE_SORT = "console-sort",
  CONSOLE_SORT_ORDER = "console-sort-order",
  CONTACT_US = "contact-us",
  CONTENT_TEMPLATE_VIEW = "content-template-view",
  COPY_OF = "copy-of",
  DATE_FROM = "date-from",
  DATE_RANGE_DIRECTION = "date-range-direction",
  DATE_RANGE_PRESET = "date-range-preset",
  DATE_TO = "date-to",
  DAYS_OF_WEEK = "days-of-week",
  DIFFICULTY = "difficulty",
  DISTANCE_MAX = "distance-max",
  DISTANCE_MIN = "distance-min",
  DIVIDER = "divider",
  DOCUMENT = "document",
  DRAFT_ID = "draft-id",
  DURATION = "duration",
  EDIT = "edit",
  EDIT_SITE = "edit-site",
  EMAIL_STATE = "email-state",
  EMAIL_TYPE = "email-type",
  END_DATE = "end-date",
  ENVIRONMENT = "environment",
  ENVIRONMENTS = "environments",
  EVENT = "event",
  EVENT_ID = "event-id",
  EVENT_INCLUSION = "event-inclusion",
  EXACT = "exact",
  EXPANDED = "expanded",
  EXPANDED_SESSIONS = "expanded-sessions",
  FACILITIES = "facilities",
  FIELD = "field",
  FILE = "file",
  FILLED_ONLY = "filled-only",
  FILTER = "filter",
  FORMAT = "format",
  FORWARD = "forward",
  FREE_ONLY = "free-only",
  FROM_POSTCODE = "from-postcode",
  GRID_COLUMNS = "grid-columns",
  GRID_GAP = "grid-gap",
  GRID_LAYOUT_MODE = "grid-layout-mode",
  GRID_SHOW_TITLES = "grid-show-titles",
  GROUPS_TABLE_HEIGHT = "groups-table-height",
  GROUP_AREA_COLORS = "group-area-colors",
  GROUP_AREA_OPACITY_HOVER = "group-area-opacity-hover",
  GROUP_AREA_OPACITY_NORMAL = "group-area-opacity-normal",
  GROUP_AREA_TEXT_OPACITY = "group-area-text-opacity",
  GROUP_CODES = "group-codes",
  IMPORT_MODE = "import-mode",
  INBOX_FILTER = "inbox-filter",
  INCLUDE_SECRETS = "include-secrets",
  LAYER = "layer",
  LAYOUT_WIDTH = "width",
  LEADERS = "leaders",
  LIST_ID = "list-id",
  LOCATION_METHOD = "location-method",
  MAILBOX_VIEW = "mailbox-view",
  MAIL_REPORT_TYPE = "mail-report-type",
  MANAGE_ACTION = "manage-action",
  MAPS_SUB_TAB = "maps-sub-tab",
  MAP_AUTO_SHOW_ALL = "map-auto-show-all",
  MAP_DISPLAY = "map-display",
  MAP_HEIGHT = "map-height",
  MAP_OS_STYLE = "map-os-style",
  MAP_PROVIDER = "map-provider",
  MAP_SHOW_CONTROLS = "map-show-controls",
  MAP_SMOOTH_SCROLL = "map-smooth-scroll",
  MAP_ZOOM = "map-zoom",
  MARKDOWN_FIELD_HIDDEN = "markdown-field-hidden",
  MAXIMISE = "maximise",
  MEDIA_SUB_TAB = "media-sub-tab",
  MEMBER = "member",
  MEMBER_ID = "member-id",
  MESSAGE = "message",
  METRIC = "metric",
  MIGRATION_MAP_EXTRACT_FROM_CONTENT = "migration-map-extract-from-content",
  MIGRATION_SITE_EXPANDED = "migration-site-expanded",
  MIGRATION_TEMPLATE_MAPPING_MODE = "migration-template-mapping-mode",
  MODAL_TAB = "modal-tab",
  NO_LOCATION = "no-location",
  OAUTH_ERROR = "oauthError",
  PAGE = "page",
  PARISH_TABLE_HEIGHT = "parish-table-height",
  PRE_FILTER = "pre-filter",
  PRINT = "print",
  PROXIMITY_LAT = "proximity-lat",
  PROXIMITY_LNG = "proximity-lng",
  PROXIMITY_RADIUS = "proximity-radius",
  Q = "q",
  RANGE = "range",
  REDIRECT = "redirect",
  REFRESH_TOKEN = "refresh-token",
  REPLY_ALL = "reply-all",
  ROLE = "role",
  SCOPE = "scope",
  SEARCH = "search",
  SECTION = "section",
  SENDER = "sender",
  SESSION = "session",
  SETUP_MODE = "setup-mode",
  SETUP_STARTED = "setupStarted",
  SHOW_UNREFERENCED_PAGES = "show-unreferenced-pages",
  SITE_SEARCH_RECENT = "site-search-recent",
  SOCIAL_DATE_CRITERIA = "social-date-criteria",
  SOCIAL_DATE_SORT = "social-date-sort",
  SOCIAL_QUICK_SEARCH = "social-quick-search",
  SORT = "sort",
  SORT_ASC = "sortAsc",
  SORT_ORDER = "sort-order",
  SOURCE_PAGE = "source-page",
  START_DATE = "start-date",
  STATUS = "status",
  STEP = "step",
  STORY = "story",
  SUBJECT = "subject",
  SUB_TAB = "sub-tab",
  SYSTEM = "system",
  TAB = "tab",
  TASK_SUB_TAB = "task-sub-tab",
  TEMPLATE_OPTIONS_VISIBLE = "template-options-visible",
  THREAD = "thread",
  TRIGGERED_BY = "triggered-by",
  VENUE_MODE = "venue-mode",
  VIEW_MODE = "view-mode",
  WALKS_ONLY = "walks-only",
  WALK_LIST_VIEW = "walk-list-view",
  WALK_SELECT_TYPE = "walk-select-type",
  WALK_SORT_ASC = "walk-sort-asc",
  WALK_TYPES = "walk-types",
}

export type StoredValueQueryParameters = Partial<Record<StoredValue, string | number | boolean | null>>;

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
