import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { RelatedLinksComponent } from "./related-links";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalksConfig } from "../../../models/walks-config.model";
import { AppInstallPlatform } from "../../../models/route-follow.model";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { MeetupService } from "../../../services/meetup.service";
import { LinksService } from "../../../services/links.service";
import { VenueService } from "../../../services/venue/venue.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { UrlService } from "../../../services/url.service";
import { AppShellService } from "../../../services/maps/app-shell.service";
import { MemberLoginService } from "../../../services/member/member-login.service";

describe("Walk directions action", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      {provide: LoggerFactory, useValue: {createLogger: () => ({info: vi.fn()})}},
      {provide: LinksService, useValue: {linksFrom: () => ({})}},
      {provide: WalkDisplayService, useValue: {gridReferenceFrom: () => null}},
      {provide: WalksConfigService, useValue: {events: () => of({})}},
      {provide: AppShellService, useValue: {platform: () => AppInstallPlatform.ANDROID, mobilePlatform: () => true}},
      {provide: MemberLoginService, useValue: {memberLoggedIn: () => false}},
      ...[GoogleMapsService, MeetupService, VenueService, UrlService].map(provide => ({provide, useValue: {}}))
    ]});
  });

  it("keeps a single directions action and opens Google driving navigation directly at the OS pin", () => {
    const fixture = TestBed.createComponent(RelatedLinksComponent);
    fixture.componentRef.setInput("displayedWalk", {walk: {fields: {}, groupEvent: {start_location: {latitude: 51.5012345, longitude: -0.1023456}}}} as DisplayedWalk);
    fixture.componentRef.setInput("walksConfigOverride", {
      relatedLinkShowDirections: true, relatedLinkShowCalendar: false, relatedLinkShowWhat3words: false
    } as WalksConfig);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll("a[href*='google.com/maps/dir/']");
    expect(links.length).toBe(1);
    expect(links[0].textContent).toContain("Drive to the start in Google Maps");
    expect(links[0].getAttribute("href")).toBe("https://www.google.com/maps/dir/?api=1&destination=51.5012345,-0.1023456&travelmode=driving&dir_action=navigate");
    const click = new MouseEvent("click", {bubbles: true, cancelable: true});
    links[0].dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    fixture.destroy();
  });
});
