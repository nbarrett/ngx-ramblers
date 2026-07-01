import { AccessLevel } from "./member-resource.model";
import { PageContent, PageContentRow, PageContentType } from "./content-text.model";

export const HOME_CONTENT_PATH = "#home-content";
export const LITE_HOME_TEMPLATE_PATH = "admin/platform/lite-templates#home-content";
export const LITE_HOME_GROUP_PLACEHOLDER = "{{groupName}}";

export function liteHomeTemplateText(): string {
  return `## Welcome to ${LITE_HOME_GROUP_PLACEHOLDER}\n\n` +
    "We use this website to keep in touch with our members by email — membership renewals, reminders and group updates. " +
    "There is nothing for you to manage here: just keep an eye on your inbox for messages from us.\n\n" +
    "Your email address is set from your Ramblers membership record, not by the group — if it changes, please update it with Ramblers so we keep receiving your messages correctly.";
}

function textRow(contentText: string): PageContentRow {
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 12,
    columns: [
      {
        columns: 12,
        accessLevel: AccessLevel.PUBLIC,
        contentText
      }
    ]
  };
}

export function liteHomeTemplatePageContent(): PageContent {
  return {
    path: LITE_HOME_TEMPLATE_PATH,
    rows: [textRow(liteHomeTemplateText())]
  };
}

export function liteHomePageContentFromTemplate(template: PageContent, groupName: string): PageContent {
  const rows = (template?.rows || []).map(row => ({
    ...row,
    columns: (row.columns || []).map(column => ({
      ...column,
      contentText: column.contentText
        ? column.contentText.split(LITE_HOME_GROUP_PLACEHOLDER).join(groupName)
        : column.contentText
    }))
  }));
  return {
    path: HOME_CONTENT_PATH,
    rows: rows.length ? rows : liteHomePageContent(groupName).rows
  };
}

export function liteHomeWelcomeText(groupName: string): string {
  return `## Welcome to ${groupName}\n\n` +
    "We use this website to keep in touch with our members by email — membership renewals, reminders and group updates. " +
    "There is nothing for you to manage here: just keep an eye on your inbox for messages from us.\n\n" +
    "Your email address is set from your Ramblers membership record, not by the group — if it changes, please update it with Ramblers so we keep receiving your messages correctly.";
}

export function liteHomePageContent(groupName: string): PageContent {
  const row: PageContentRow = {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 12,
    columns: [
      {
        columns: 12,
        accessLevel: AccessLevel.PUBLIC,
        contentText: liteHomeWelcomeText(groupName)
      }
    ]
  };
  return {
    path: HOME_CONTENT_PATH,
    rows: [row]
  };
}
