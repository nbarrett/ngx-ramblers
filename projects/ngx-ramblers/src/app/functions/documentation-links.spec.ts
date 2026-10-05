import { ENVIRONMENT_SUBDOMAIN_BASE } from "../models/environment-setup.model";
import { firstLinkHref } from "./strings";
import { documentationFeaturePath, documentationFeatureUrl, documentationLinkPath, documentationLinkTitle, documentationLinkUrl, documentationSiteOrigin, documentationWebsitePickerEnabled } from "./documentation-links";

describe("documentation links", () => {
  it("preserves queries and fragments on the chosen website", () => {
    expect(documentationLinkUrl("{{siteUrl}}/admin/mail-settings?tab=lists#subscriptions", "https://group.example.org.uk/"))
      .toBe("https://group.example.org.uk/admin/mail-settings?tab=lists#subscriptions");
  });

  it("recognises placeholder encoding produced by markdown", () => {
    expect(documentationLinkPath("%7B%7BsiteUrl%7D%7D/admin/inbox")).toBe("/admin/inbox");
  });

  it("rejects destinations that could escape the selected site", () => {
    ["{{siteUrl}}//example.com", "{{siteUrl}}/\\example.com", "{{siteUrl}}javascript:alert(1)", "{{siteUrl}}/admin\n/inbox"].forEach(value => {
      expect(documentationLinkUrl(value, "https://group.example.org.uk")).toBeNull();
    });
    expect(documentationSiteOrigin("javascript:alert(1)")).toBeNull();
    expect(documentationSiteOrigin("https://alex:password@group.example.org.uk")).toBeNull();
  });
});

describe("documentation feature paths", () => {
  it("rewrites application destinations and leaves documentation and GitHub links alone", () => {
    expect(documentationFeaturePath("walks/my-walks")).toBe("/walks/my-walks");
    expect(documentationFeaturePath("/walks/admin/routes")).toBe("/walks/admin/routes");
    expect(documentationFeaturePath("/admin/inbox?tab=messages")).toBe("/admin/inbox?tab=messages");
    expect(documentationFeaturePath("/how-to/committee/routes")).toBeNull();
    expect(documentationFeaturePath("/how-to/committee/release-notes/2026-10-04-issue-403")).toBeNull();
    expect(documentationFeaturePath("/contact-us")).toBeNull();
    expect(documentationFeaturePath("https://github.com/example/repo/issues/1")).toBeNull();
    expect(documentationFeatureUrl("walks/my-walks", "https://group.example.org.uk"))
      .toBe("https://group.example.org.uk/walks/my-walks");
    expect(documentationLinkTitle("Hillside Walkers"))
      .toBe("Opens on Hillside Walkers. Click the gear above to change this.");
  });
});

describe("documentation website picker host", () => {
  it("is available on the documentation website and on localhost when platform admin is on", () => {
    expect(documentationWebsitePickerEnabled(ENVIRONMENT_SUBDOMAIN_BASE, false)).toBe(true);
    expect(documentationWebsitePickerEnabled(`www.${ENVIRONMENT_SUBDOMAIN_BASE}`, false)).toBe(true);
    expect(documentationWebsitePickerEnabled("localhost", true)).toBe(true);
    expect(documentationWebsitePickerEnabled("127.0.0.1", true)).toBe(true);
  });

  it("is hidden on group websites and on localhost when platform admin is off", () => {
    expect(documentationWebsitePickerEnabled("group.example.org.uk", true)).toBe(false);
    expect(documentationWebsitePickerEnabled(`hillside.${ENVIRONMENT_SUBDOMAIN_BASE}`, true)).toBe(false);
    expect(documentationWebsitePickerEnabled("localhost", false)).toBe(false);
    expect(documentationWebsitePickerEnabled("127.0.0.1", false)).toBe(false);
  });
});

describe("documentation screenshot links", () => {
  it("inherits the first text link website marker without changing ordinary link extraction", () => {
    const text = '[Inbox](/admin/inbox?tab=messages "{{siteUrl}}")';
    expect(firstLinkHref(text, true)).toBe("{{siteUrl}}/admin/inbox?tab=messages");
    expect(firstLinkHref(text)).toBe("/admin/inbox?tab=messages");
    expect(firstLinkHref("[Help](/how-to/example)", true)).toBe("/how-to/example");
  });
});
