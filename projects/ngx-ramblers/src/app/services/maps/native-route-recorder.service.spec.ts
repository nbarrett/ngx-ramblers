import { Capacitor } from "@capacitor/core";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { NativeRouteError, NativeRouteEvent, NativeRouteFailure, NativeRoutePosition } from "../../models/native-route.model";
import { NATIVE_ROUTE_RECORDER, NativeRouteRecorderService } from "./native-route-recorder.service";

const native = {
  enabled: true,
  start: vi.fn(), stop: vi.fn(), positions: vi.fn(), addListener: vi.fn(),
  listeners: new Map<string, (failure?: NativeRouteFailure) => void>()
};

describe("NativeRouteRecorderService", () => {
  const point = (timestamp: number): NativeRoutePosition => ({latitude: 51, longitude: timestamp / 100000,
    accuracy: 5, altitude: 12, heading: 90, timestamp});

  beforeEach(() => {
    native.enabled = true;
    vi.spyOn(Capacitor, "isNativePlatform").mockImplementation(() => native.enabled);
    vi.spyOn(Capacitor, "isPluginAvailable").mockImplementation(() => native.enabled);
    native.listeners.clear();
    native.start.mockReset().mockResolvedValue(null);
    native.stop.mockReset().mockResolvedValue(null);
    native.positions.mockReset().mockResolvedValue({sessionId: "fictional-recording", positions: []});
    native.addListener.mockReset().mockImplementation(async (event: NativeRouteEvent, listener: (failure?: NativeRouteFailure) => void) => {
      native.listeners.set(event, listener);
      return {remove: vi.fn()};
    });
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [{provide: NATIVE_ROUTE_RECORDER, useValue: native}]});
  });

  it("replays background fixes once and drains on return without restarting the native recorder", async () => {
    const service = TestBed.inject(NativeRouteRecorderService);
    const receive = vi.fn();
    native.positions.mockResolvedValueOnce({sessionId: "fictional-recording", positions: [point(1000), point(6000), point(11000)]});
    service.start("fictional-recording", false, 1000, receive, vi.fn());
    await service["operations"];
    expect(receive.mock.calls.map(call => call[0].timestamp)).toEqual([6000, 11000]);
    native.positions.mockResolvedValueOnce({sessionId: "fictional-recording", positions: [point(11000), point(16000)]});
    service.resume();
    await service["operations"];
    expect(receive.mock.calls.map(call => call[0].timestamp)).toEqual([6000, 11000, 16000]);
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(native.stop).not.toHaveBeenCalled();
    expect(native.positions).toHaveBeenLastCalledWith({sessionId: "fictional-recording", after: 11000});
  });

  it("does not deliver old points after the user has stopped recording", async () => {
    const service = TestBed.inject(NativeRouteRecorderService);
    const receive = vi.fn();
    const pending = {resolve: null as ((batch: {sessionId: string; positions: NativeRoutePosition[]}) => void) | null};
    native.positions.mockImplementationOnce(() => new Promise(resolve => pending.resolve = resolve));
    service.start("fictional-recording", false, 0, receive, vi.fn());
    await vi.waitFor(() => expect(pending.resolve).not.toBeNull());
    service.stop();
    pending.resolve({sessionId: "fictional-recording", positions: [point(1000)]});
    await service["operations"];
    expect(receive).not.toHaveBeenCalled();
    expect(native.stop).toHaveBeenCalledTimes(1);
  });

  it("serialises stopping and starting and rejects a batch belonging to another recording", async () => {
    const service = TestBed.inject(NativeRouteRecorderService);
    const receive = vi.fn();
    service.start("previous-recording", true, 0, vi.fn(), vi.fn());
    await service["operations"];
    service.stop();
    service.start("fictional-recording", true, 0, receive, vi.fn());
    native.positions.mockResolvedValue({sessionId: "previous-recording", positions: [point(1000)]});
    await service["operations"];
    expect(native.start.mock.calls).toEqual([[{sessionId: "previous-recording", reset: true}], [{sessionId: "fictional-recording", reset: true}]]);
    expect(native.stop.mock.invocationCallOrder[0]).toBeGreaterThan(native.start.mock.invocationCallOrder[0]);
    expect(native.stop.mock.invocationCallOrder[0]).toBeLessThan(native.start.mock.invocationCallOrder[1]);
    expect(receive).not.toHaveBeenCalled();
  });

  it("reports native permission failure without silently switching to foreground browser GPS", async () => {
    const service = TestBed.inject(NativeRouteRecorderService);
    const fail = vi.fn();
    native.start.mockRejectedValue({code: NativeRouteError.DENIED, message: "Enable precise location"});
    service.start("fictional-recording", true, 0, vi.fn(), fail);
    await service["operations"];
    expect(fail).toHaveBeenCalledWith({code: NativeRouteError.DENIED, message: "Enable precise location"});
    expect(native.positions).not.toHaveBeenCalled();
  });

  it("waits for background fixes before saving and reports a failed recovery", async () => {
    const service = TestBed.inject(NativeRouteRecorderService);
    const receive = vi.fn();
    service.start("fictional-recording", false, 0, receive, vi.fn());
    await service["operations"];
    native.positions.mockResolvedValueOnce({sessionId: "fictional-recording", positions: [point(6000)]});
    expect(await service.flush()).toBe(true);
    expect(receive).toHaveBeenCalledWith(point(6000));
    native.positions.mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await service.flush()).toBe(false);
  });

  it("keeps browser sessions independent of the native bridge", () => {
    native.enabled = false;
    const service = TestBed.inject(NativeRouteRecorderService);
    expect(service.supported()).toBe(false);
    service.stop();
    expect(native.stop).not.toHaveBeenCalled();
  });
});
