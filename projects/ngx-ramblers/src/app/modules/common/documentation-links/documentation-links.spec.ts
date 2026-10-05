import { StoredValue } from "../../../models/ui-actions";
import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { MarkdownModule } from "ngx-markdown";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { BehaviorSubject } from "rxjs";
import { vi } from "vitest";
import { DocumentationLinksComponent } from "./documentation-links";
import { DocumentationLinksService } from "../../../services/documentation-links.service";
import { documentationFeaturePath, documentationFeatureUrl } from "../../../functions/documentation-links";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { DocumentationSite } from "../../../models/documentation-links.model";

@Component({
  imports: [DocumentationLinksComponent, MarkdownModule],
  template: `<app-documentation-links><div markdown [data]="markdown()"></div><a class="screenshot" [href]="screenshot" [attr.data-documentation-link]="screenshot">Screenshot</a></app-documentation-links>`
})
class DocumentationHost {
  screenshot = "{{siteUrl}}/admin/inbox";
  markdown = signal("[Inbox](/admin/inbox \"{{siteUrl}}\") [Help](/how-to/example) [Direct]({{siteUrl}}/walks/routes)");
}

const sites: DocumentationSite[] = [
  {name: "hillside", label: "Hillside Walkers", url: "https://group.example.org.uk"},
  {name: "park", label: "Park Walkers", url: "https://park.example.org.uk"}
];

function setup(selected: string | null = null, sharedSite: string | null = null, platformAdminEnabled = true) {
  const selection = new BehaviorSubject<string | null>(selected);
  const platformAdmin = new BehaviorSubject(platformAdminEnabled);
  const links = {
    selection,
    sites: vi.fn().mockResolvedValue(sites),
    select: (name: string) => selection.next(name),
    destinationPath: (href: string, origins: string[] = []) => documentationFeaturePath(href, origins),
    destinationUrl: (href: string, siteUrl: string, origins: string[] = []) => documentationFeatureUrl(href, siteUrl, origins)
  };
  TestBed.configureTestingModule({
    imports: [DocumentationHost, MarkdownModule.forRoot(), TooltipModule.forRoot()],
    providers: [provideRouter([]), HumanisePipe,
      {provide: ActivatedRoute, useValue: {queryParamMap: new BehaviorSubject(convertToParamMap(sharedSite ? {[StoredValue.DOCUMENTATION_SITE]: sharedSite} : {}))}},
      {provide: DocumentationLinksService, useValue: links},
      {provide: MemberResourcesReferenceDataService, useValue: {platformAdminOn: () => platformAdmin.value, platformAdminEnabledChanges: () => platformAdmin}},
      {provide: LoggerFactory, useValue: {createLogger: () => ({error: vi.fn()})}}]
  });
  const fixture = TestBed.createComponent(DocumentationHost);
  fixture.detectChanges();
  return {fixture, links};
}

describe("documentation website links", () => {
  it("hides the website picker when this is not the documentation website", async () => {
    const {fixture, links} = setup(null, null, false);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll("div[markdown] a")).toHaveLength(3);
    });
    const component = fixture.debugElement.children[0].componentInstance as DocumentationLinksComponent;
    expect(component.pickerEnabled).toBe(false);
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
    expect(links.sites).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe("/admin/inbox");
    fixture.destroy();
  });

  it("leaves documentation navigation unchanged until a website is chosen", async () => {
    const {fixture} = setup();
    const component = fixture.debugElement.children[0].componentInstance as DocumentationLinksComponent;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(component.items).toHaveLength(2);
    });
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain("Which website would you like to open?");
    const inbox = fixture.nativeElement.querySelector("a") as HTMLAnchorElement;
    expect(inbox.getAttribute("href")).toBe("/admin/inbox");
    expect(fixture.nativeElement.querySelectorAll("a")[1].getAttribute("href")).toBe("/how-to/example");
    expect(fixture.nativeElement.querySelector(".screenshot").getAttribute("href")).toBe("{{siteUrl}}/admin/inbox");
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).toBeNull();
    const button = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("Choose which website documentation links open");
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).not.toBeNull();
    fixture.destroy();
  });

  it("hides the selector after choosing a website and reopens it from the change button", async () => {
    const {fixture} = setup();
    const component = fixture.debugElement.children[0].componentInstance as DocumentationLinksComponent;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(component.items).toHaveLength(2);
    });
    component.select("hillside");
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).toBeNull();
    const button = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("Documentation links open on Hillside Walkers");
    expect(button.classList.contains("btn-icon")).toBe(true);
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).toBeNull();
    expect(component.selectedName).toBe("hillside");
    fixture.nativeElement.querySelector("button").click();
    fixture.detectChanges();
    const reset = fixture.nativeElement.querySelector("button[aria-label='Reset documentation website choice']") as HTMLButtonElement;
    reset.click();
    fixture.detectChanges();
    expect(component.selectedName).toBeNull();
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe("/admin/inbox");
    component.select("park");
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#documentation-site-selector")).toBeNull();
    fixture.destroy();
  });

  it("shows duplicate website addresses once and preserves a remembered environment alias", async () => {
    const {fixture, links} = setup("hillside-copy");
    links.sites.mockResolvedValue([...sites, {name: "hillside-copy", label: "Hillside Walkers", url: sites[0].url}]);
    const component = fixture.debugElement.children[0].componentInstance as DocumentationLinksComponent;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(component.items).toHaveLength(2);
      expect(component.items.find(item => item.description === sites[0].url)?.name).toBe("hillside-copy");
    });
    expect(links.selection.value).toBe("hillside-copy");
    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe("https://group.example.org.uk/admin/inbox");
    fixture.destroy();
  });

  it("suggests only a registered referring website without applying it", async () => {
    const referrer = vi.spyOn(document, "referrer", "get").mockReturnValue("https://park.example.org.uk/walks");
    try {
      const {fixture, links} = setup();
      const component = fixture.debugElement.children[0].componentInstance as DocumentationLinksComponent;
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.suggestedName).toBe("park");
      });
      expect(links.selection.value).toBeNull();
      expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe("/admin/inbox");
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain("This website is suggested because you arrived from it.");
      component.select("park");
      fixture.detectChanges();
      expect(links.selection.value).toBe("park");
      expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe("https://park.example.org.uk/admin/inbox");
      fixture.destroy();
    } finally {
      referrer.mockRestore();
    }
  });

  it("ignores unrelated referring sites", async () => {
    const referrer = vi.spyOn(document, "referrer", "get").mockReturnValue("https://unrelated.example.org/walks");
    try {
      const {fixture} = setup();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll("div[markdown] a")).toHaveLength(3);
      });
      const component = fixture.debugElement.children[0].componentInstance as DocumentationLinksComponent;
      expect(component.suggestedName).toBeNull();
      expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe("/admin/inbox");
      fixture.destroy();
    } finally {
      referrer.mockRestore();
    }
  });

  it("restores the website from a shared documentation URL", async () => {
    const {fixture} = setup("hillside", "park");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".screenshot").getAttribute("href")).toBe("https://park.example.org.uk/admin/inbox");
    });
  });

  it("renders real markdown links on the saved site and updates them when the site changes", async () => {
    const {fixture, links} = setup("hillside");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll("div[markdown] a")).toHaveLength(3);
    });
    fixture.detectChanges();
    const anchors = fixture.nativeElement.querySelectorAll("a");
    expect(anchors[0].getAttribute("href")).toBe("https://group.example.org.uk/admin/inbox");
    expect(anchors[0].getAttribute("title")).toBeNull();
    expect(anchors[0].getAttribute("data-documentation-tooltip")).toBe("Opens on Hillside Walkers. Click the gear above to change this.");
    expect(anchors[1].getAttribute("href")).toBe("/how-to/example");
    expect(anchors[2].getAttribute("href")).toBe("https://group.example.org.uk/walks/routes");
    expect(fixture.nativeElement.querySelector(".screenshot").getAttribute("href")).toBe("https://group.example.org.uk/admin/inbox");
    expect(fixture.nativeElement.querySelector(".screenshot").getAttribute("title")).toBeNull();
    expect(fixture.nativeElement.querySelector(".screenshot").getAttribute("data-documentation-tooltip")).toBe("Opens on Hillside Walkers. Click the gear above to change this.");
    links.select("park");
    fixture.detectChanges();
    expect(anchors[0].getAttribute("href")).toBe("https://park.example.org.uk/admin/inbox");
    expect(fixture.nativeElement.querySelector(".screenshot").getAttribute("href")).toBe("https://park.example.org.uk/admin/inbox");
    links.select(null);
    fixture.detectChanges();
    expect(anchors[0].getAttribute("href")).toBe("/admin/inbox");
    fixture.destroy();
  });

  it("rewrites newly rendered content and cleans up subscriptions when destroyed", async () => {
    const {fixture, links} = setup("hillside");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll("div[markdown] a")).toHaveLength(3);
    });
    fixture.componentInstance.markdown.set("[Lists](/admin/mail-settings?tab=lists#subscriptions \"{{siteUrl}}\")");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("a").getAttribute("href"))
        .toBe("https://group.example.org.uk/admin/mail-settings?tab=lists#subscriptions");
    });
    fixture.destroy();
    expect(links.selection.observed).toBe(false);
  });
});
