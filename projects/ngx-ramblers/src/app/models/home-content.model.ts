import { AccessLevel } from "./member-resource.model";
import { PageContent, PageContentRow, PageContentType } from "./content-text.model";

export const HOME_CONTENT_PATH = "#home-content";
export const LITE_HOME_TEMPLATE_PATH = "admin/platform/lite-templates#home-content";
export const LITE_HOME_GROUP_PLACEHOLDER = "{{groupName}}";

const LITE_HOME_HERO_IMAGE = "https://www.ngx-ramblers.org.uk/api/aws/s3/site-content/3a90e61d-ce79-46d2-bdce-2de3557fcbea.jpeg";
const LITE_HOME_GUIDES_IMAGE = "https://www.ngx-ramblers.org.uk/api/aws/s3/site-content/f8c43f63-0136-4104-83d8-62aa4f2457fd.jpeg";

function headingText(groupNameToken: string): string {
  return `# Welcome to ${groupNameToken}`;
}

function welcomeText(): string {
  return "We use this website to keep in touch with our members by email — membership renewals, reminders and group updates. " +
    "There is nothing for you to manage here: just keep an eye on your inbox for messages from us.\n\n" +
    "Your email address comes from your Ramblers membership record, not from us. If it changes, please update it with Ramblers so our messages keep reaching you.";
}

function guidesHeadingText(): string {
  return "## Running the group's email";
}

function gettingStartedButtonText(): string {
  return "[Getting started with NGX-Ramblers](https://www.ngx-ramblers.org.uk/how-to/committee/getting-started)\n\n" +
    "New to NGX-Ramblers? This walks you through logging in and finding your way around.";
}

function emailGuidesButtonText(): string {
  return "[Browse the email guides](https://www.ngx-ramblers.org.uk/how-to/committee/email-articles)\n\n" +
    "Step-by-step guides, each with screenshots: sending emails, committee-role forwarding, mailing lists, and the wording of automatic messages.";
}

function liteHomeRows(groupNameToken: string): PageContentRow[] {
  return [
    {
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 1,
      columns: [
        {
          columns: 12,
          accessLevel: AccessLevel.PUBLIC,
          contentText: headingText(groupNameToken)
        }
      ]
    },
    {
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 1,
      columns: [
        {
          columns: 12,
          accessLevel: AccessLevel.PUBLIC,
          imageSource: LITE_HOME_HERO_IMAGE,
          imageBorderRadius: 6,
          showTextAfterImage: true,
          contentText: welcomeText()
        }
      ]
    },
    {
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 1,
      columns: [
        {
          columns: 12,
          accessLevel: AccessLevel.PUBLIC,
          contentText: guidesHeadingText()
        }
      ]
    },
    {
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 3,
      columns: [
        {
          columns: 3,
          accessLevel: AccessLevel.PUBLIC,
          contentText: gettingStartedButtonText(),
          styles: { class: "as-button" }
        },
        {
          columns: 3,
          accessLevel: AccessLevel.PUBLIC,
          contentText: emailGuidesButtonText(),
          styles: { class: "as-button" }
        },
        {
          columns: 6,
          accessLevel: AccessLevel.PUBLIC,
          imageSource: LITE_HOME_GUIDES_IMAGE,
          imageBorderRadius: 6
        }
      ]
    }
  ];
}

export function liteHomeTemplatePageContent(): PageContent {
  return {
    path: LITE_HOME_TEMPLATE_PATH,
    rows: liteHomeRows(LITE_HOME_GROUP_PLACEHOLDER)
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

export function liteHomePageContent(groupName: string): PageContent {
  return {
    path: HOME_CONTENT_PATH,
    rows: liteHomeRows(groupName)
  };
}
