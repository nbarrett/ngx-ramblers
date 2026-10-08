import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { GoogleMapsService } from "./google-maps.service";

describe("GoogleMapsService", () => {
  let service: GoogleMapsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        GoogleMapsService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(GoogleMapsService);
    http.expectOne("/api/google-maps/config").flush({apiKey: "test-key", zoomLevel: 12});
  });

  afterEach(() => {
    http.verify();
  });

  it("builds a driving directions embed, not a place pin", () => {
    const url = String(service.directionsEmbedUrl("AA11 1AA", "BB22 2BB"));
    expect(url).toContain("maps/embed/v1/directions");
    expect(url).toContain("mode=driving");
    expect(url).toContain("origin=AA11%201AA");
    expect(url).toContain("destination=BB22%202BB");
  });

  it("returns driving miles from the Distance Matrix endpoint", async () => {
    const milesPromise = service.drivingDistanceMiles("AA11 1AA", "BB22 2BB");
    const request = http.expectOne(req => req.url === "/api/google-maps/driving-distance");
    expect(request.request.params.get("from")).toEqual("AA11 1AA");
    expect(request.request.params.get("to")).toEqual("BB22 2BB");
    request.flush({miles: 12, metres: 19312, from: "AA11 1AA", to: "BB22 2BB"});
    expect(await milesPromise).toEqual(12);
  });

  it("passes coordinates when calculating miles for a place name", async () => {
    const milesPromise = service.drivingDistanceMiles("Hillside Park", "AA11 1AA", {lat: 51.1, lng: 0.8}, {lat: 51.2, lng: 1.1});
    const request = http.expectOne(req => req.url === "/api/google-maps/driving-distance");
    expect(request.request.params.get("from")).toEqual("Hillside Park");
    expect(request.request.params.get("fromLat")).toEqual("51.1");
    expect(request.request.params.get("fromLng")).toEqual("0.8");
    expect(request.request.params.get("toLat")).toEqual("51.2");
    expect(request.request.params.get("toLng")).toEqual("1.1");
    request.flush({miles: 12, metres: 19312, from: "Hillside Park", to: "AA11 1AA"});
    expect(await milesPromise).toEqual(12);
  });
});
