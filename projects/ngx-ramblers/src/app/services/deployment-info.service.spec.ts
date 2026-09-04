import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RELEASE_FEED_TYPE, ReleaseFeed } from "../models/release-feed.model";
import { DeploymentInfoService } from "./deployment-info.service";

function entry(title: string, path: string) {
  return {title, path, url: `https://example.org/${path}`, markdownUrl: "", jsonUrl: "", htmlUrl: "", hasImages: false};
}

const feed: ReleaseFeed = {
  title: "Releases",
  description: "",
  type: RELEASE_FEED_TYPE,
  generated: "2026-09-04T00:00:00Z",
  indexPath: "how-to/committee/release-notes",
  indexUrl: "",
  humansIndexPath: null,
  humansIndexUrl: null,
  entries: [
    entry("03-Sep-2026 — build 877 — #384 — refresh members after post-send actions", "how-to/committee/release-notes/2026-09-03"),
    entry("03-Sep-2026 — build 877 — #363 — reassign committee roles", "how-to/committee/release-notes/2026-09-03-roles"),
    entry("02-Sep-2026 — build 876 — #380 — committee statistics", "how-to/committee/release-notes/2026-09-02"),
    entry("01-Sep-2026 — build 87 — #375 — bulk load fix", "how-to/committee/release-notes/2026-09-01")
  ]
};

describe("DeploymentInfoService", () => {
  let service: DeploymentInfoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
    service = TestBed.inject(DeploymentInfoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("finds every release note whose title names the running build, matching the whole number", () => {
    expect(service.releaseNotesForBuild(feed, "877").map(entry => entry.path)).toEqual(["how-to/committee/release-notes/2026-09-03", "how-to/committee/release-notes/2026-09-03-roles"]);
    expect(service.releaseNotesForBuild(feed, "87").map(entry => entry.path)).toEqual(["how-to/committee/release-notes/2026-09-01"]);
  });

  it("returns nothing when no release note mentions the build", () => {
    expect(service.releaseNotesForBuild(feed, "900")).toEqual([]);
    expect(service.releaseNotesForBuild(null, "877")).toEqual([]);
  });

  it("asks the server for the release feed with the requested limit", async () => {
    const pending = service.releaseFeed(5);
    const request = httpMock.expectOne(candidate => candidate.url === "/api/public/releases" && candidate.params.get("limit") === "5");
    request.flush(feed);
    expect((await pending).entries.length).toBe(4);
  });
});
