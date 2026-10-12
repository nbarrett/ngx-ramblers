import { Capacitor } from "@capacitor/core";
import { saveNativeWalkingSite } from "../../functions/native-walking";
import { RouteFollowMode, RouteFollowSession } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";
import { LegacyWalkingRecoveryService } from "./legacy-walking-recovery.service";

const session = {mode: RouteFollowMode.RECORDING, recordingId: "fictional-recording", recordedPoints: [{latitude: 51, longitude: 0}]} as RouteFollowSession;

describe("recovering earlier native walking data", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
    window.localStorage.removeItem(StoredValue.FOLLOW_SESSION);
  });

  function recovery() {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    saveNativeWalkingSite("https://first.example.org.uk");
    window.localStorage.setItem(StoredValue.FOLLOW_SESSION, JSON.stringify(session));
    const values: Record<string, unknown> = {};
    const service = Object.create(LegacyWalkingRecoveryService.prototype) as LegacyWalkingRecoveryService;
    service["cache"] = {
      legacyRoutes: vi.fn().mockResolvedValue([{key: "walk:fictional-walk", title: "Hillside path"}]),
      restoreLegacyRoutes: vi.fn().mockImplementation(async (keys: string[]) => keys)
    } as unknown as typeof service["cache"];
    service["uiActions"] = {
      initialObjectValueFor: (key: string, fallback: unknown) => values[key] || fallback,
      itemExistsFor: (key: string) => !!values[key],
      saveValueFor: vi.fn().mockImplementation((key: string, value: unknown) => {values[key] = value; return true;})
    } as unknown as typeof service["uiActions"];
    service["memberLogin"] = {loggedInMember: () => null} as unknown as typeof service["memberLogin"];
    return {service, values};
  }

  it("lists earlier data without automatically changing its ownership or recording", async () => {
    const {service} = recovery();
    const available = await service.available();
    expect(available.routes.length).toBe(1);
    expect(available.session).toEqual(session);
    expect(service["cache"].restoreLegacyRoutes).not.toHaveBeenCalled();
    expect(service["uiActions"].saveValueFor).not.toHaveBeenCalled();
  });

  it("restores only the selected data and keeps the original recording", async () => {
    const {service, values} = recovery();
    await service.restore(["walk:fictional-walk"], true);
    expect(service["cache"].restoreLegacyRoutes).toHaveBeenCalledWith(["walk:fictional-walk"], "https://first.example.org.uk");
    expect(values[StoredValue.FOLLOW_SESSION]).toEqual(session);
    expect(JSON.parse(window.localStorage.getItem(StoredValue.FOLLOW_SESSION))).toEqual(session);
    expect(values[StoredValue.APP_LEGACY_RECOVERY]).toEqual({"route:walk:fictional-walk": "https://first.example.org.uk", "session:recording:fictional-recording": "https://first.example.org.uk"});
    saveNativeWalkingSite("https://second.example.org.uk");
    values[StoredValue.FOLLOW_SESSION] = null;
    expect(await service.available()).toEqual({routes: [], session: null});
  });

  it("does not replace an existing current walking session", async () => {
    const {service, values} = recovery();
    const current = {recordingId: "current-recording"};
    values[StoredValue.FOLLOW_SESSION] = current;
    await service.restore([], true);
    expect(values[StoredValue.FOLLOW_SESSION]).toEqual(current);
  });
});
