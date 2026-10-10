import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { DistanceRangeSlider } from "./distance-range-slider";
import { StringUtilsService } from "../../services/string-utils.service";

describe("live distance filtering", () => {
  afterEach(() => vi.useRealTimers());

  it("emits live values during movement while keeping the settled change debounced", () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [{
        provide: StringUtilsService,
        useValue: {
          pluraliseWithCount: (count: number, singular: string, plural?: string) => `${count} ${count === 1 ? singular : (plural || singular + "s")}`
        }
      }]
    });
    const slider = TestBed.runInInjectionContext(() => new DistanceRangeSlider());
    slider.ngOnInit();
    const live = vi.fn();
    const settled = vi.fn();
    slider.rangeInput.subscribe(live);
    slider.rangeChange.subscribe(settled);
    slider.highValue = 10;
    slider.onHighChange();
    expect(live).toHaveBeenLastCalledWith(expect.objectContaining({max: 10}));
    slider.highValue = 20;
    slider.onHighChange();
    expect(live).toHaveBeenLastCalledWith(expect.objectContaining({max: 20}));
    expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(settled).toHaveBeenCalledOnce();
    expect(settled).toHaveBeenLastCalledWith(expect.objectContaining({max: 20}));
    slider.ngOnDestroy();
  });
});
