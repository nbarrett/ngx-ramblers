import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";
import { ViewAsBar } from "./view-as-bar";
import { ViewAsService } from "../../../services/member/view-as.service";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { AuthService } from "../../../auth/auth.service";
import { MemberService } from "../../../services/member/member.service";
import { MemberSelector } from "../../../shared/components/member-selector";

function setup(impersonating: boolean, available = true, chromeVisible = false) {
  const viewAs = {
    optedInChanges: new BehaviorSubject(false),
    chromeVisibleChanges: new BehaviorSubject(chromeVisible),
    availableChanges: new BehaviorSubject(available),
    memberIdFromLocation: () => impersonating ? "alex-reed" : null,
    roleTypeFromLocation: () => null,
    hydrateFromLocation: vi.fn().mockResolvedValue(null),
    currentMember: () => ({id: "fictional-member", firstName: "Alex", lastName: "Reed"}),
    clear: vi.fn(),
    setChromeVisible: vi.fn()
  };
  TestBed.configureTestingModule({
    imports: [ViewAsBar],
    providers: [
      {provide: ViewAsService, useValue: viewAs},
      {provide: CommitteeConfigService, useValue: {committeeConfigEvents: () => new BehaviorSubject({roles: []})}},
      {provide: AuthService, useValue: {parseAuthToken: () => null}},
      {provide: MemberService, useValue: {getById: vi.fn()}}
    ]
  });
  TestBed.overrideComponent(ViewAsBar, {remove: {imports: [MemberSelector]}, add: {schemas: [NO_ERRORS_SCHEMA]}});
  const fixture = TestBed.createComponent(ViewAsBar);
  fixture.detectChanges();
  return {fixture, viewAs};
}

describe("View As recovery bar", () => {
  it("allows the entire bar to be hidden while keeping the selected profile loaded", async () => {
    const {fixture, viewAs} = setup(true);
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll("button")] as HTMLButtonElement[];
    expect(buttons).toEqual([]);
    expect(viewAs.hydrateFromLocation).toHaveBeenCalledOnce();
    viewAs.chromeVisibleChanges.next(true);
    fixture.detectChanges();
    const restoredButtons = [...fixture.nativeElement.querySelectorAll("button")] as HTMLButtonElement[];
    expect(restoredButtons.map(button => button.textContent.trim())).toEqual(["Return to my profile", "Hide"]);
    restoredButtons[0].click();
    expect(viewAs.clear).toHaveBeenCalledOnce();
    fixture.destroy();
  });

  it("does not expose or hydrate impersonation when the feature is unavailable", () => {
    const {fixture, viewAs} = setup(true, false);
    expect(fixture.nativeElement.querySelector(".view-as-bar")).toBeNull();
    expect(viewAs.hydrateFromLocation).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it("keeps the bar hidden when it is disabled and there is no impersonation", () => {
    const {fixture, viewAs} = setup(false);
    expect(fixture.nativeElement.querySelector(".view-as-bar")).toBeNull();
    expect(viewAs.hydrateFromLocation).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it("loads an active impersonation when availability arrives after initialisation", async () => {
    const {fixture, viewAs} = setup(true, false, true);
    viewAs.availableChanges.next(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".view-as-bar")).not.toBeNull();
    expect(viewAs.hydrateFromLocation).toHaveBeenCalledOnce();
    fixture.destroy();
  });
});
