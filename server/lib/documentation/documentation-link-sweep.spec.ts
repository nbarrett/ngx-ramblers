import expect from "expect";
import { describe, it } from "mocha";
import { documentationMenuLinks, rewriteDocumentationMarkdown, sweepDocumentationPage } from "./documentation-link-sweep";
import { DocumentationLinkChange } from "../../../projects/ngx-ramblers/src/app/models/documentation-links.model";
import { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

const context = {origins: ["https://group.example.org.uk"], menuLinks: documentationMenuLinks([])};

describe("documentation link sweep", () => {
  it("rewrites old admin destinations and tab aliases without changing documentation links", () => {
    const markdown = "[Members](/admin/member-admin) and [Lists](https://group.example.org.uk/admin/mail-settings?tab=mail-list-settings#list). [Help](/how-to/committee).";
    const rewritten = rewriteDocumentationMarkdown(markdown, context);
    expect(rewritten).toEqual("[Members](/admin/members/member-admin \"{{siteUrl}}\") and [Lists](/admin/mail-settings?tab=lists#list \"{{siteUrl}}\"). [Help](/how-to/committee).");
    expect(rewriteDocumentationMarkdown(rewritten, context)).toEqual(rewritten);
  });

  it("links menu instructions using existing domain paths and tabs", () => {
    const rewritten = rewriteDocumentationMarkdown("Open **Admin → Members → Member Bulk Load**. Go to Mail Settings → Domains.", context);
    expect(rewritten).toEqual("Open [**Admin → Members → Member Bulk Load**](/admin/members/member-bulk-load \"{{siteUrl}}\"). Go to [Mail Settings → Domains](/admin/mail-settings?tab=domains \"{{siteUrl}}\").");
    expect(rewriteDocumentationMarkdown(rewritten, context)).toEqual(rewritten);
  });

  it("protects external consoles, platform operations, images, code fences and configuration examples", () => {
    const markdown = "**Facebook Login for Business → Settings**\n[Console](https://external.example.com/admin/inbox)\n[Platform](/admin/platform)\n![Screenshot](/admin/inbox)\n```ts\nconst path = '/admin/member-admin';\n```\nOAuth redirect URI: `https://group.example.org.uk/admin/settings/system-settings`";
    expect(rewriteDocumentationMarkdown(markdown, context)).toEqual(markdown);
  });

  it("links bare paths without splitting a walks path", () => {
    expect(rewriteDocumentationMarkdown("Open walks/admin/import, then `/admin/member-admin`.", context))
      .toEqual("Open [/walks/admin/import](/walks/admin/import \"{{siteUrl}}\"), then [/admin/members/member-admin](/admin/members/member-admin \"{{siteUrl}}\").");
  });

  it("removes ad-hoc host labels and preserves surrounding content", () => {
    expect(rewriteDocumentationMarkdown("[`<your-website-address>/admin/mail-settings?tab=lists`](/admin/mail-settings?tab=lists)", context))
      .toEqual("[your website/admin/mail-settings?tab=lists](/admin/mail-settings?tab=lists \"{{siteUrl}}\")");
  });

  it("walks nested CMS content without touching image URLs or the original page", () => {
    const page = {id: "page", path: "how-to/example", rows: [{columns: [{imageSource: "https://group.example.org.uk/admin/image.png", rows: [{columns: [{contentText: "[Members](/admin/member-admin)"}]}]}]}]} as PageContent;
    const changes: DocumentationLinkChange[] = [];
    const updated = sweepDocumentationPage(page, context, changes);
    expect(changes).toHaveLength(1);
    expect(updated.rows[0].columns[0].rows[0].columns[0].contentText).toContain("{{siteUrl}}");
    expect(updated.rows[0].columns[0].imageSource).toEqual(page.rows[0].columns[0].imageSource);
    expect(page.rows[0].columns[0].rows[0].columns[0].contentText).toEqual("[Members](/admin/member-admin)");
  });
});

describe("documentation sweep compatibility", () => {
  it("preserves HTML link labels and custom titles", () => {
    const html = "<a href='/admin/member-admin' title='Members'>Open members</a>";
    const rewritten = rewriteDocumentationMarkdown(html, context);
    expect(rewritten).toEqual("<a href=\"/admin/members/member-admin\" title=\"{{siteUrl}} Members\">Open members</a>");
    expect(rewriteDocumentationMarkdown(rewritten, context)).toEqual(rewritten);
    expect(rewriteDocumentationMarkdown("[Members](/admin/member-admin \"Members\")", context))
      .toEqual("[Members](/admin/members/member-admin \"{{siteUrl}} Members\")");
  });

  it("aligns obsolete tabs and leaves platform destinations on the documentation host", () => {
    const markdown = "[Group](/admin/system-settings?tab=group-details) [Queue](/admin/mail-settings?tab=campaign-queue) [Platform](/admin/environment-management)";
    expect(rewriteDocumentationMarkdown(markdown, context)).toEqual("[Group](/admin/settings/system-settings?tab=area-group \"{{siteUrl}}\") [Queue](/admin/settings/system-settings?tab=scheduled-tasks&task-sub-tab=brevo \"{{siteUrl}}\") [Platform](/admin/environment-management)");
  });
});
