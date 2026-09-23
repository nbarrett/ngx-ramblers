import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { LocationExtractionService } from "./location-extraction.service";
import { PageContent, PageContentType } from "../models/content-text.model";
import { AccessLevel } from "../models/member-resource.model";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";

describe("LocationExtractionService", () => {
  let service: LocationExtractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        MemberIdToFullNamePipe,
        FullNamePipe,
        FullNameWithAliasPipe,
        SearchFilterPipe,
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(LocationExtractionService);
  });

  it("pins a nested route page using the route start and markdown heading", () => {
    const start = {latitude: 51.2, longitude: 1.16, description: "Barham"};
    const page = {
      path: "walks/routes/recommended/barham-and-four-churches-walk",
      rows: [
        {
          type: PageContentType.TEXT,
          columns: [{
            columns: 12,
            accessLevel: AccessLevel.PUBLIC,
            imageSource: "site-content/banner.jpg",
            contentText: "## Four Churches Walk: Barham"
          }]
        },
        {
          type: PageContentType.TEXT,
          columns: [{
            columns: 8,
            accessLevel: AccessLevel.PUBLIC,
            rows: [{
              type: PageContentType.ROUTE,
              columns: [],
              routeGuide: {title: "Four Churches Walk", start_location: start}
            }]
          }]
        }
      ]
    } as PageContent;

    const columns = service.extractLocationsFromPages([page]);
    expect(columns.length).toBe(1);
    expect(columns[0].title).toBe("Four Churches Walk");
    expect(columns[0].location?.latitude).toBe(51.2);
    expect(columns[0].location?.longitude).toBe(1.16);
    expect(columns[0].imageSource).toBe("site-content/banner.jpg");
  });

  it("cannot pin a route page when nested route data is omitted from the query", () => {
    const page = {
      path: "walks/routes/recommended/barham-and-four-churches-walk",
      rows: [
        {type: PageContentType.TEXT, columns: [{imageSource: "site-content/banner.jpg"}]},
        {type: PageContentType.TEXT, columns: [{}]}
      ]
    } as PageContent;

    const columns = service.extractLocationsFromPages([page]);
    expect(columns[0].location).toBeNull();
  });
});
