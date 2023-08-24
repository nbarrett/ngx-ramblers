export enum NamedEventType {
    APPLY_FILTER = "apply-filter",
    DEFAULT_LOGO_CHANGED = "default-logo-changed",
    EDIT_SITE = "editSite",
    ERROR = "error",
    MAILCHIMP_LISTS_CHANGED = "mailchimp-lists-changed",
    MARKDOWN_CONTENT_CHANGED = "markdownContentChanged",
    MARKDOWN_CONTENT_DELETED = "markdownContentDeleted",
    MARKDOWN_CONTENT_SYNCED = "markdownContentSynced",
    MARKDOWN_CONTENT_UNSAVED = "markdownContentUnsaved",
    MEETUP_DEFAULT_CONTENT_CHANGED = "meetupContentChanged",
    MEMBER_LOGIN_COMPLETE = "memberLoginComplete",
    MEMBER_LOGOUT_COMPLETE = "memberLogoutComplete",
    MENU_TOGGLE = "menu-toggle",
    PAGE_CONTENT_CHANGED = "page-content-changed",
    REFRESH = "refresh",
    SAVE_PAGE_CONTENT = "save-page-content",
    SHOW_PAGINATION = "show-pagination",
    SYSTEM_CONFIG_LOADED = "system-config-loaded",
    WALK_SAVED = "walkSaved",
    WALK_SLOTS_CREATED = "walk-slots-created",
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
