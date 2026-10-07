import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { GroupEventField } from "../../models/walk.model";
import { WalksConfigService } from "../system/walks-config.service";
import { GridReferenceDigits } from "../../models/walks-config.model";
import { DateUtilsService } from "../date-utils.service";
import { WalkNotificationValueService } from "./walk-notification-value.service";

const walksConfigServiceStub = {
  walksConfig: () => ({
    walkDetailsGridReferenceDigits: GridReferenceDigits.EIGHT,
    walkDetailsGridReferenceSpaced: true
  })
};

describe("WalkNotificationValueService location", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        WalkNotificationValueService,
        DateUtilsService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {provide: WalksConfigService, useValue: walksConfigServiceStub}
      ]
    });
  });

  it("drops police force areas from a location description", () => {
    const service = TestBed.inject(WalkNotificationValueService);
    const text = service.format(GroupEventField.START_LOCATION, {
      description: "Bromley, Metropolitan Police",
      postcode: "BR1 1AA"
    });
    expect(text).toContain("Bromley");
    expect(text).not.toContain("Metropolitan Police");
    expect(text).toContain("BR1 1AA");
  });

  it("formats a grid reference to the walk configuration when that part is requested", () => {
    const service = TestBed.inject(WalkNotificationValueService);
    expect(service.format(GroupEventField.START_LOCATION, {
      description: "Chilham",
      grid_reference_10: "TR0862317039"
    }, {description: false, postcode: false, gridReference: true})).toEqual("grid reference TR 0862 1703");
  });

  it("omits grid reference and postcode when those extras are off", () => {
    const service = TestBed.inject(WalkNotificationValueService);
    expect(service.format(GroupEventField.START_LOCATION, {
      description: "Bromley, Metropolitan Police",
      postcode: "BR1 1AA",
      grid_reference_10: "TR0862317039"
    }, {description: true, postcode: false, gridReference: false})).toEqual("Bromley");
  });
});
