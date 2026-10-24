import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { AvailableAreasService } from "./available-areas.service";

describe("area directory reload", () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]}));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it("reuses a loaded directory until an explicit refresh requests current data", async () => {
    const service = TestBed.inject(AvailableAreasService);
    const http = TestBed.inject(HttpTestingController);
    const original = service.areas();
    http.expectOne("api/areas/available-areas").flush({areas: [{areaName: "Hillside", areaCode: "HS"}]});
    expect(await original).toEqual([{areaName: "Hillside", areaCode: "HS", ngSelectLabel: "Hillside (HS)"}]);
    await service.areas();
    http.expectNone("api/areas/available-areas");
    const refreshed = service.areas(true);
    http.expectOne("api/areas/available-areas").flush({areas: [{areaName: "Riverside", areaCode: "RS"}]});
    expect(await refreshed).toEqual([{areaName: "Riverside", areaCode: "RS", ngSelectLabel: "Riverside (RS)"}]);
  });

  it("can retry after an initial directory request fails", async () => {
    const service = TestBed.inject(AvailableAreasService);
    const http = TestBed.inject(HttpTestingController);
    const original = service.areas();
    const failure = expect(original).rejects.toMatchObject({status: 503});
    http.expectOne("api/areas/available-areas").flush({}, {status: 503, statusText: "Unavailable"});
    await failure;
    const retry = service.areas(true);
    http.expectOne("api/areas/available-areas").flush({areas: []});
    await expect(retry).resolves.toEqual([]);
  });
});
