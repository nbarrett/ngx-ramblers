import { TestBed } from "@angular/core/testing";
import { of, Subject } from "rxjs";
import { PostcodeNavigationCheckComponent } from "./postcode-navigation-check";
import { PostcodeNavigationService } from "../../services/maps/postcode-navigation.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { PostcodeNavigationCheck, PostcodeNavigationStatus, PostcodeRoadCheckStatus } from "../../models/postcode-navigation.model";
import { StoredValue } from "../../models/ui-actions";
import { DistanceUnit } from "../../models/walk.model";
import { RouteFollowService } from "../../services/maps/route-follow.service";
import { UiActionsService } from "../../services/ui-actions.service";

describe("Postcode navigation feedback", () => {
  const check = vi.fn();
  const result: PostcodeNavigationCheck = {
    location: {latitude: 51.5, longitude: -0.1, postcode: "AB1 2CD", description: null,
      grid_reference_6: null, grid_reference_8: null, grid_reference_10: null, w3w: null},
    postcode: "AB1 2CD", postcodePoint: {lat: 51.5, lng: -0.0812}, separationMetres: 1300,
    drivingMetres: null, status: PostcodeNavigationStatus.SEPARATED, roadStatus: PostcodeRoadCheckStatus.NOT_CHECKED
  };

  beforeEach(() => {
    vi.useFakeTimers();
    check.mockReset().mockReturnValue(of(result));
    TestBed.configureTestingModule({providers: [
      {provide: PostcodeNavigationService, useValue: {check}},
      {provide: MemberLoginService, useValue: {memberLoggedIn: () => true}},
      {provide: RouteFollowService, useValue: {formatDistance: (metres: number) => `${(metres / 1609.344).toFixed(1)} miles`}},
      {provide: UiActionsService, useValue: {initialValueFor: () => DistanceUnit.MILES}}
    ]});
  });

  afterEach(() => vi.useRealTimers());

  it("automatically displays the mismatch and offers the two-pin comparison without modifying coordinates", async () => {
    const fixture = TestBed.createComponent(PostcodeNavigationCheckComponent);
    fixture.componentRef.setInput("latitude", 51.5);
    fixture.componentRef.setInput("longitude", -0.1);
    fixture.componentRef.setInput("postcode", "AB1 2CD");
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Postcode directions alone are inaccurate");
    expect(fixture.nativeElement.textContent).toContain("0.8 miles");
    expect(fixture.nativeElement.textContent).not.toContain("Omit postcode");
    const url = new URL(fixture.componentInstance.comparisonUrl, "https://group.example.org.uk");
    const points = JSON.parse(url.searchParams.get(StoredValue.LOCATE_POINTS));
    expect(points[0].slice(0, 2)).toEqual([51.5, -0.1]);
    expect(points[1].slice(0, 2)).toEqual([51.5, -0.0812]);
    expect(fixture.componentInstance.latitude).toBe(51.5);
    fixture.destroy();
  });

  it("uses a working in-page comparison button when embedded on Locate", async () => {
    const fixture = TestBed.createComponent(PostcodeNavigationCheckComponent);
    fixture.componentRef.setInput("latitude", 51.5);
    fixture.componentRef.setInput("longitude", -0.1);
    fixture.componentRef.setInput("postcode", "AB1 2CD");
    fixture.componentRef.setInput("compareInPlace", true);
    const compared = vi.spyOn(fixture.componentInstance.compare, "emit");
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button").click();
    expect(compared).toHaveBeenCalledWith(result);
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
    fixture.destroy();
  });

  it("ignores old results while a newer pin is waiting for its debounced check", async () => {
    const pending = new Subject<PostcodeNavigationCheck>();
    check.mockReturnValue(pending);
    const fixture = TestBed.createComponent(PostcodeNavigationCheckComponent);
    fixture.componentRef.setInput("latitude", 51.5);
    fixture.componentRef.setInput("longitude", -0.1);
    fixture.componentRef.setInput("postcode", "AB1 2CD");
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);
    fixture.componentRef.setInput("latitude", 51.501);
    fixture.detectChanges();
    pending.next(result);
    expect(fixture.componentInstance.result).toBeNull();
    expect(fixture.componentInstance.pending).toBe(true);
    fixture.destroy();
  });
});
