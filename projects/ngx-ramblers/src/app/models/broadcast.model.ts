export enum NamedEventType {
    APPLY_FILTER = "apply-filter",
    CONTENT_METADATA_CHANGED = "content-metadata-changed",
    DEFAULT_LOGO_CHANGED = "default-logo-changed",
    EDIT_SITE = "editSite",
    ERROR = "error",
    FILES_DROPPED = "files-dropped",
    MAILCHIMP_LISTS_CHANGED = "mailchimp-lists-changed",
    MAIL_LISTS_CHANGED = "mail-lists-changed",
    MAIL_SUBSCRIPTION_CHANGED = "mail-subscription-changed",
    MARKDOWN_CONTENT_CHANGED = "markdown-content-changed",
    MARKDOWN_CONTENT_DELETED = "markdown-content-deleted",
    MARKDOWN_CONTENT_SYNCED = "markdown-content-synced",
    MARKDOWN_CONTENT_UNSAVED = "markdown-content-unsaved",
    MEETUP_DEFAULT_CONTENT_CHANGED = "meetup-content-changed",
    MEMBER_LOGIN_COMPLETE = "member-login-complete",
    MEMBER_LOGOUT_COMPLETE = "member-logout-complete",
    MENU_TOGGLE = "menu-toggle",
    NOTIFY_MESSAGE = "notify-message",
    PAGE_CONTENT_CHANGED = "page-content-changed",
    REFRESH = "refresh",
    SAVE_PAGE_CONTENT = "save-page-content",
    SHOW_PAGINATION = "show-pagination",
    SYSTEM_CONFIG_LOADED = "system-config-loaded",
    WALKS_CONFIG_LOADED = "walks-config-loaded",
    WALK_SAVED = "walkSaved",
    WALK_SLOTS_CREATED = "walk-slots-created",
    MARKDOWN_EDITOR_CREATED = "markdown-editor-created",
    MARKDOWN_EDITOR_DESTROYED = "markdown-editor-destroyed",
}

export class NamedEvent<T> {
    static named(name: NamedEventType): NamedEvent<NamedEventType> {
        return new NamedEvent(name);
    }

    constructor(public name: any, public data?: T) {
    }

    static withData<T>(key: NamedEventType, value: T) {
        return new NamedEvent(key, value);
    }
}
