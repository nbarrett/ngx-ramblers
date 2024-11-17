import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AddressQueryService } from "./address-query.service";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

describe("addressQueryService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule,
        RouterTestingModule],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
}).compileComponents());

  describe("gridReferenceFrom", () => {

    it("should return grid reference for Kent", () => {
      const addressQueryService: AddressQueryService = TestBed.inject(AddressQueryService);
      expect(addressQueryService.gridReferenceFrom("589060", "140509")).toBe("TQ 89060 40509");
    });

    it("should return grid reference for Scotland", () => {
      const addressQueryService: AddressQueryService = TestBed.inject(AddressQueryService);
      expect(addressQueryService.gridReferenceFrom("403183" , "078709")).toBe("SZ 03183 78709");
    });

  });

  describe("gridCodeFrom", () => {

    it("should return grid code for Kent", () => {
      const addressQueryService: AddressQueryService = TestBed.inject(AddressQueryService);
      expect(addressQueryService.gridCodeFrom("589060", "140509")).toBe("TQ");
    });

    it("should return grid code for Scotland", () => {
      const addressQueryService: AddressQueryService = TestBed.inject(AddressQueryService);
      expect(addressQueryService.gridCodeFrom("403183" , "078709")).toBe("SZ");
    });

  });

});
