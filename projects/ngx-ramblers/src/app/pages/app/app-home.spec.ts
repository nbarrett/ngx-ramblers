import { AppHomeComponent } from "./app-home";
import { RouteFollowMode, RouteFollowSession } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";

describe("standalone recording launch", () => {
  function view(): AppHomeComponent {
    const component = Object.create(AppHomeComponent.prototype) as AppHomeComponent;
    component["memberLogin"] = {memberLoggedIn: () => true} as unknown as typeof component["memberLogin"];
    component["followService"] = {requestCompassPermission: vi.fn().mockResolvedValue(null)} as unknown as typeof component["followService"];
    component["router"] = {navigate: vi.fn().mockResolvedValue(true)} as unknown as typeof component["router"];
    component["activeSession"] = null;
    return component;
  }

  it("opens a new recording without a walk or route after sign-in", () => {
    const component = view();
    component.recordStandaloneRoute();
    const navigation = vi.mocked(component["router"].navigate).mock.calls[0];
    expect(navigation[0]).toEqual(["/app/follow"]);
    expect(navigation[1].queryParams[StoredValue.RECORD_ROUTE]).toMatch(/^[a-zA-Z0-9-]{8,80}$/);
    expect(navigation[1].queryParams[StoredValue.WALK_ID]).toBeFalsy();
    expect(component["followService"].requestCompassPermission).toHaveBeenCalledOnce();
  });

  it("opens the unfinished recording instead of replacing it with a new draft", () => {
    const component = view();
    component["activeSession"] = {recordingId: "fictional-id", mode: RouteFollowMode.PAUSED} as RouteFollowSession;
    component.recordStandaloneRoute();
    expect(component["router"].navigate).toHaveBeenCalledWith(["/app/follow"], {queryParams: {[StoredValue.RECORD_ROUTE]: "fictional-id"}});
  });

  it("waits for sign-in before launching a recording", () => {
    const component = view();
    component["afterSignIn"] = vi.fn();
    component.recordStandaloneRoute();
    expect(component["afterSignIn"]).toHaveBeenCalledOnce();
    expect(component["router"].navigate).not.toHaveBeenCalled();
  });
});
