import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { ContentMetadata } from "../models/content-metadata.model";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";
import { ContentMetadataService } from "./content-metadata.service";
import { StringUtilsService } from "./string-utils.service";
import { RootFolder } from "../models/system.model";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

describe("ContentMetadataService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule],
    providers: [
        {
            provide: ActivatedRoute, useValue: {
                queryParams: {
                    subscribe: () => {
                    }
                }, snapshot: { url: ["admin", "member-bulk-load"] }
            }
        },
        StringUtilsService,
        MemberIdToFullNamePipe,
        FullNamePipe,
        FullNameWithAliasPipe,
        SearchFilterPipe,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
}));

  const input: ContentMetadata = {
    id: "53729e3fb1e8b51319e3a2ec",
    imageTags: [],
    files: [
      {
        image: "aws/s3/imagesHome/5c02d083-35c5-4175-9411-3698d1af7f68.jpeg",
        text: "Sabine's walk around Egerton and Grafty Green"
      },
      {
        image: "api/aws/s3/imagesHome/b2ed2654-cf74-4370-a0e8-20165802415a.jpeg",
        text: "Tim's walk around Benenden"
      },
    ]
  };

  const output: ContentMetadata = {
    id: "53729e3fb1e8b51319e3a2ec",
    rootFolder: RootFolder.carousels,
    name: "imagesHome",
    imageTags: [],
    files: [
      {
        image: "5c02d083-35c5-4175-9411-3698d1af7f68.jpeg",
        text: "Sabine's walk around Egerton and Grafty Green"
      },
      {
        image: "b2ed2654-cf74-4370-a0e8-20165802415a.jpeg",
        text: "Tim's walk around Benenden"
      },
    ]
  };
  it("should transform ContentMetadataApiResponse with incorrect image paths to correct ones of type ContentMetadata", () => {
    const service: ContentMetadataService = TestBed.inject(ContentMetadataService);
    expect(service.optionallyMigrate(input, RootFolder.carousels, "imagesHome")).toEqual(output);
  });

  it("should support projected album summaries without files", () => {
    const service: ContentMetadataService = TestBed.inject(ContentMetadataService);
    const summary = {id: "album-id", rootFolder: RootFolder.carousels, name: "imagesHome"} as ContentMetadata;

    expect(service.optionallyMigrate(summary, RootFolder.carousels, "imagesHome")).toEqual({...summary, files: []});
  });

  it("should use the album's prevailing event source for new images", () => {
    const service: ContentMetadataService = TestBed.inject(ContentMetadataService);

    expect(service.defaultDateSourceFor([
      {dateSource: "upload"},
      {dateSource: "walks"},
      {dateSource: "social"},
      {dateSource: "walks"}
    ])).toEqual("walks");
    expect(service.defaultDateSourceFor([{dateSource: "upload"}])).toEqual("upload");
  });

  it("should fetch and reuse a lightweight carousel album catalogue", async () => {
    const service: ContentMetadataService = TestBed.inject(ContentMetadataService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const summary = {id: "album-id", rootFolder: RootFolder.carousels, name: "imagesHome"} as ContentMetadata;
    const notifications: any[] = [];
    service.contentMetadataNotifications().subscribe(notification => notifications.push(notification));
    const firstRequest = service.albumCatalogue();
    const secondRequest = service.albumCatalogue();
    const request = httpTesting.expectOne(req => req.url === "api/database/content-metadata/all");

    expect(JSON.parse(request.request.params.get("criteria"))).toEqual({rootFolder: RootFolder.carousels});
    expect(JSON.parse(request.request.params.get("select"))).toEqual({name: 1, rootFolder: 1, aspectRatio: 1, maxImageSize: 1});
    request.flush({response: [summary]});

    expect(await firstRequest).toEqual([{...summary, files: []}]);
    expect(await secondRequest).toEqual([{...summary, files: []}]);
    expect(notifications).toEqual([]);
  });
});
