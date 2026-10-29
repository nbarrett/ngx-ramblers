import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { InboxLayoutService } from "./inbox-layout.service";

describe("inbox responsive layout", () => {
  beforeEach(() => TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [InboxLayoutService]}));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    {width: 1366, height: 550, touch: false, mobile: false},
    {width: 1024, height: 540, touch: false, mobile: false},
    {width: 390, height: 844, touch: true, mobile: true},
    {width: 844, height: 390, touch: true, mobile: true},
    {width: 1024, height: 768, touch: true, mobile: false}
  ])("uses the correct layout for $width × $height with touch=$touch", ({width, height, touch, mobile}) => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({matches: touch} as MediaQueryList));
    const layout = TestBed.inject(InboxLayoutService);
    layout.updateMobile();
    expect(layout.mobile).toBe(mobile);
  });
});
