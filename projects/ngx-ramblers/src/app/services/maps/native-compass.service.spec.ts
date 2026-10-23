import { Capacitor } from "@capacitor/core";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { NativeCompassEvent, NativeCompassHeading } from "../../models/native-compass.model";
import { NATIVE_COMPASS, NativeCompassService } from "./native-compass.service";

const native = {
  enabled: true,
  start: vi.fn(),
  stop: vi.fn(),
  addListener: vi.fn(),
  listener: null as ((payload: NativeCompassHeading) => void) | null
};

describe("NativeCompassService", () => {
  beforeEach(() => {
    native.enabled = true;
    native.listener = null;
    vi.spyOn(Capacitor, "isNativePlatform").mockImplementation(() => native.enabled);
    vi.spyOn(Capacitor, "getPlatform").mockImplementation(() => native.enabled ? "android" : "web");
    vi.spyOn(Capacitor, "isPluginAvailable").mockImplementation(name => native.enabled && name === "NativeCompass");
    native.start.mockReset().mockResolvedValue(null);
    native.stop.mockReset().mockResolvedValue(null);
    native.addListener.mockReset().mockImplementation(async (_event: NativeCompassEvent, listener: (payload: NativeCompassHeading) => void) => {
      native.listener = listener;
      return {remove: vi.fn()};
    });
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [{provide: NATIVE_COMPASS, useValue: native}]});
  });

  it("is only available on native Android", () => {
    const service = TestBed.inject(NativeCompassService);
    expect(service.supported()).toBe(true);
    native.enabled = false;
    expect(service.supported()).toBe(false);
  });

  it("shows calibration guidance for poor accuracy and clears it after recovery or stop", async () => {
    const service = TestBed.inject(NativeCompassService);
    service.start(vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(service.calibrationRecommended()).toBe(false);
    native.listener?.({heading: 42, calibrationRecommended: true});
    expect(service.calibrationRecommended()).toBe(true);
    native.listener?.({heading: 43, calibrationRecommended: false});
    expect(service.calibrationRecommended()).toBe(false);
    native.listener?.({heading: 44, calibrationRecommended: true});
    service.stop();
    expect(service.calibrationRecommended()).toBe(false);
    native.listener?.({heading: 45, calibrationRecommended: true});
    expect(service.calibrationRecommended()).toBe(false);
  });

  it("abandons a listener that registers after stop", async () => {
    const pending = {resolve: null as ((handle: {remove: ReturnType<typeof vi.fn>}) => void) | null};
    const lateRemove = vi.fn();
    native.addListener.mockImplementation(() => new Promise(resolve => {
      pending.resolve = resolve;
    }));
    const service = TestBed.inject(NativeCompassService);
    service.start(vi.fn());
    service.stop();
    pending.resolve?.({remove: lateRemove});
    await Promise.resolve();
    await Promise.resolve();
    expect(native.start).not.toHaveBeenCalled();
    expect(lateRemove).toHaveBeenCalledTimes(1);
  });

  it("starts only the latest overlapping request", async () => {
    const first = {resolve: null as ((handle: {remove: ReturnType<typeof vi.fn>}) => void) | null};
    const second = {resolve: null as ((handle: {remove: ReturnType<typeof vi.fn>}) => void) | null};
    const firstRemove = vi.fn();
    const secondRemove = vi.fn();
    native.addListener
      .mockImplementationOnce(() => new Promise(resolve => {
        first.resolve = resolve;
      }))
      .mockImplementationOnce(() => new Promise(resolve => {
        second.resolve = resolve;
      }));
    const service = TestBed.inject(NativeCompassService);
    service.start(vi.fn());
    service.start(vi.fn());
    first.resolve?.({remove: firstRemove});
    await Promise.resolve();
    await Promise.resolve();
    expect(native.start).not.toHaveBeenCalled();
    expect(firstRemove).toHaveBeenCalledTimes(1);
    second.resolve?.({remove: secondRemove});
    await Promise.resolve();
    await Promise.resolve();
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(secondRemove).not.toHaveBeenCalled();
  });

  it.each([true, false])("preserves the restarted compass when the earlier start finishes first=%s", async earlierFinishesFirst => {
    const first = {resolve: null as (() => void) | null};
    const second = {resolve: null as (() => void) | null};
    const firstRemove = vi.fn();
    const secondRemove = vi.fn();
    native.addListener.mockImplementation(async (_event: NativeCompassEvent, listener: (payload: NativeCompassHeading) => void) => {
      native.listener = listener;
      return {remove: native.addListener.mock.calls.length === 1 ? firstRemove : secondRemove};
    });
    native.start
      .mockImplementationOnce(() => new Promise<void>(resolve => first.resolve = resolve))
      .mockImplementationOnce(() => new Promise<void>(resolve => second.resolve = resolve));
    const service = TestBed.inject(NativeCompassService);
    service.start(vi.fn());
    await Promise.resolve();
    service.stop();
    const receive = vi.fn();
    service.start(receive);
    await Promise.resolve();
    const completions = earlierFinishesFirst ? [first, second] : [second, first];
    for (const completion of completions) {
      completion.resolve();
      await Promise.resolve();
    }
    native.listener?.({heading: 90});
    expect(receive).toHaveBeenCalledWith(90);
    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(secondRemove).not.toHaveBeenCalled();
    expect(native.stop).toHaveBeenCalledTimes(1);
    service.stop();
    expect(secondRemove).toHaveBeenCalledTimes(1);
  });

  it("stops a native start that completes after the session was stopped", async () => {
    const pending = {resolve: null as (() => void) | null};
    native.start.mockImplementationOnce(() => new Promise<void>(resolve => pending.resolve = resolve));
    const service = TestBed.inject(NativeCompassService);
    service.start(vi.fn());
    await Promise.resolve();
    service.stop();
    pending.resolve();
    await Promise.resolve();
    expect(native.stop).toHaveBeenCalledTimes(2);
  });

  it("forwards native headings and ignores values after stop", async () => {
    const service = TestBed.inject(NativeCompassService);
    const receive = vi.fn();
    service.start(receive);
    await Promise.resolve();
    await Promise.resolve();
    native.listener?.({heading: 42});
    expect(receive).toHaveBeenCalledWith(42);
    service.stop();
    native.listener?.({heading: 90});
    expect(receive).toHaveBeenCalledTimes(1);
    expect(native.stop).toHaveBeenCalledTimes(1);
  });
});
