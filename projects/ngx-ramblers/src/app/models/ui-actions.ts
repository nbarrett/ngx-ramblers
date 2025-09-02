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
  AUTH_TOKEN = "auth-token",
  CAROUSEL="carousel",
  EDIT_SITE = "edit-site",
  MARKDOWN_FIELD_HIDDEN = "markdown-field-hidden",
  REFRESH_TOKEN = "refresh-token",
  SHOW_UNREFERENCED_PAGES = "show-unreferenced-pages",
  SOCIAL_DATE_CRITERIA = "social-date-criteria",
  SOCIAL_DATE_SORT = "social-date-sort",
  SOCIAL_QUICK_SEARCH = "social-quick-search",
  STORY = "story",
  TAB = "tab",
  WALK_LIST_VIEW = "walk-list-view",
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

export interface HasTrackingAttribute {
  tracking: string;
}
