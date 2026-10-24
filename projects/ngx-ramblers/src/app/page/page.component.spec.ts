import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { MarkdownModule } from "ngx-markdown";
import { LoggerTestingModule } from "ngx-logger/testing";
import { PageService } from "../services/page.service";
import { PageComponent } from "./page.component";

function setup(title: string, suppliedTitle: string | null = null) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({matches: false})));
  const contentTitle = signal(title);
  TestBed.configureTestingModule({
    imports: [PageComponent, LoggerTestingModule, MarkdownModule.forRoot()],
    providers: [provideRouter([]), {
      provide: PageService,
      useValue: {
        contentPageTitle: contentTitle,
        nested: () => false,
        relativePages: () => [],
        pageSubtitle: () => "Guide",
        setTitle: vi.fn()
      }
    }]
  });
  const fixture = TestBed.createComponent(PageComponent);
  if (suppliedTitle) {
    fixture.componentRef.setInput("pageTitle", suppliedTitle);
  }
  fixture.detectChanges();
  return {fixture, contentTitle};
}

describe("page headings", () => {
  it("renders lifted Markdown links, entities and emphasis inline within one heading", async () => {
    const {fixture} = setup("Route &amp; **directions** [#123](https://example.org/issues/123) and `GPX`");
    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Route & directions #123 and GPX");
    });
    const heading = fixture.nativeElement.querySelector("h1");
    expect(heading.querySelector("a").getAttribute("href")).toBe("https://example.org/issues/123");
    expect(heading.querySelector("strong").textContent).toBe("directions");
    expect(heading.querySelector("code").textContent).toBe("GPX");
    expect(heading.querySelector("p, h1")).toBeNull();
    expect(fixture.nativeElement.querySelectorAll("h1")).toHaveLength(1);
  });

  it("updates the rendered heading when the content page changes", async () => {
    const {fixture, contentTitle} = setup("First **guide**");
    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector("h1").textContent).toBe("First guide");
    });
    contentTitle.set("Next [guide](/how-to/example)");
    fixture.detectChanges();
    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Next guide");
    });
    expect(fixture.nativeElement.querySelector("h1 a").getAttribute("href")).toBe("/how-to/example");
  });

  it("continues to treat explicitly supplied page titles as plain text", async () => {
    const {fixture} = setup("Content **heading**", "Plain <title> & text");
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Plain <title> & text");
    expect(fixture.nativeElement.querySelector("h1 title")).toBeNull();
  });

  it("sanitises unsafe HTML in Markdown headings", async () => {
    const {fixture} = setup("Guide <img src=x onerror=alert(1)> [unsafe](javascript:alert%281%29)");
    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector("h1").textContent).toContain("Guide");
    });
    const heading = fixture.nativeElement.querySelector("h1");
    expect(heading.querySelector("[onerror]")).toBeNull();
    expect(heading.querySelector("a[href^=\"javascript:\"]")).toBeNull();
  });
});
