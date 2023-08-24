import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AddressQueryService } from "./address-query.service";

describe("addressQueryService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [
      LoggerTestingModule,
      HttpClientTestingModule,
      RouterTestingModule,
    ],
    providers: []
  }).compileComponents());

  describe("gridReferenceFrom", () => {

    it("should return grid reference for Kent", () => {
      const addressQueryService: AddressQueryService = TestBed.inject(AddressQueryService);
      expect(addressQueryService.gridReferenceFrom("589060", "140509")).toBe("TQ 890405");
    });

    it("should return grid reference for Scotland", () => {
      const addressQueryService: AddressQueryService = TestBed.inject(AddressQueryService);
      expect(addressQueryService.gridReferenceFrom("403183" , "078709")).toBe("SZ 031787");
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
