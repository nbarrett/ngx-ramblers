import { TestBed } from "@angular/core/testing";
import { convertToParamMap, NavigationEnd, Router, ActivatedRoute } from "@angular/router";
import { Subject, of } from "rxjs";
import { LoggerTestingModule } from "ngx-logger/testing";
import { vi } from "vitest";
import { WalksViewSelector } from "./walk-view-selector";
import { EventDispatchService } from "../../group-events/group-event-view/event-dispatch-service";
import { EventViewDispatch } from "../../../models/group-event.model";
import { StoredValue } from "../../../models/ui-actions";
import { NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WalkDisplayService } from "../walk-display.service";

describe("opening a newly created album from its own URL", () => {
  const path = "/walks/photos/2026/hillside-park";
  const url = `${path}?${StoredValue.ALBUM_WORKFLOW}=1`;
  const events = new Subject<NavigationEnd>();
  const eventView = vi.fn();
  const components: WalksViewSelector[] = [];

  beforeEach(() => {
    eventView.mockReset();
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        {provide: Router, useValue: {url, events}},
        {provide: ActivatedRoute, useValue: {queryParamMap: of(convertToParamMap({[StoredValue.ALBUM_WORKFLOW]: "1"})), snapshot: {queryParamMap: convertToParamMap({[StoredValue.ALBUM_WORKFLOW]: "1"})}}},
        {provide: EventDispatchService, useValue: {eventView}},
        {provide: NotifierService, useValue: {createAlertInstance: () => ({})}},
        {provide: UrlService, useValue: {}},
        {provide: StringUtilsService, useValue: {}},
        {provide: WalkDisplayService, useValue: {}}
      ]
    });
  });

  afterEach(() => {
    components.forEach(component => component.ngOnDestroy());
    components.splice(0);
  });

  it("rechecks an event fallback after Create album navigates to the same URL", async () => {
    eventView.mockResolvedValueOnce({eventView: EventViewDispatch.VIEW}).mockResolvedValue({eventView: EventViewDispatch.DYNAMIC_CONTENT});
    const component = TestBed.runInInjectionContext(() => new WalksViewSelector());
    components.push(component);
    await component.ngOnInit();
    events.next(new NavigationEnd(1, url, url));
    await Promise.resolve();
    expect(eventView).toHaveBeenCalledTimes(2);
    expect(component["eventView"].eventView).toBe(EventViewDispatch.DYNAMIC_CONTENT);
  });

  it("does not reload an open album when selecting an individual photo", async () => {
    eventView.mockResolvedValue({eventView: EventViewDispatch.DYNAMIC_CONTENT});
    const component = TestBed.runInInjectionContext(() => new WalksViewSelector());
    components.push(component);
    await component.ngOnInit();
    const selectedPhotoUrl = `${url}&${StoredValue.ALBUM_EDIT_PHOTO}=1`;
    events.next(new NavigationEnd(1, selectedPhotoUrl, selectedPhotoUrl));
    expect(eventView).toHaveBeenCalledOnce();
  });
});
