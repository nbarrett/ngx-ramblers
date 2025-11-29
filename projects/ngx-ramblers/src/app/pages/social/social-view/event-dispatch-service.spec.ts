import { TestBed } from "@angular/core/testing";
import { EventDispatchService } from "./event-dispatch-service";
import { EventViewDispatch, ExtendedGroupEvent } from "../../../models/group-event.model";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";

class MockLoggerFactory {
  createLogger() {
    return {
      info() {},
      debug() {},
      warn() {},
      error() {},
      off() {}
    };
  }
}

class MockPageContentService {
  response: any = null;
  findByPath = jasmine.createSpy("findByPath").and.callFake(() => Promise.resolve(this.response));
}

class MockPageService {
  value = "";
  contentPath = jasmine.createSpy("contentPath").and.callFake(() => this.value);
}

class MockWalksAndEventsService {
  response: any = null;
  queryById = jasmine.createSpy("queryById").and.callFake(() => Promise.resolve(this.response));
}

class MockUrlService {
  segments: string[] = [];

  pathSegments() {
    return this.segments;
  }

  setPath(path: string) {
    this.segments = path.split("/").filter(item => item);
  }

  lastPathSegment() {
    return this.segments[this.segments.length - 1];
  }

  private looksLikeMongoId(value: string) {
    return /^[0-9a-f]{24}$/i.test(value);
  }

  pathContainsMongoId(): boolean {
    return this.segments.some(segment => this.looksLikeMongoId(segment));
  }

  pathContainsNumericRamblersId(): boolean {
    const last = this.lastPathSegment();
    return !!last && /^\d+$/.test(last) && +last > 100000000;
  }

  pathContainsEventIdOrSlug(): boolean {
    const last = this.lastPathSegment();
    if (!last) {
      return false;
    }
    const looksLikeSlug = /^[a-z0-9-]+$/i.test(last.trim());
    return this.pathContainsMongoId() || this.pathContainsNumericRamblersId() || (this.segments.length === 2 && looksLikeSlug);
  }
}

class MockStringUtilsService {
  pluraliseWithCount(count: number, singular: string) {
    return `${count} ${count === 1 ? singular : singular + "s"}`;
  }
}

describe("EventDispatchService", () => {
  let service: EventDispatchService;
  let pageService: MockPageService;
  let pageContentService: MockPageContentService;
  let urlService: MockUrlService;
  let walksAndEventsService: MockWalksAndEventsService;
  const notify = {warning: jasmine.createSpy("warning")} as unknown as AlertInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EventDispatchService,
        {provide: LoggerFactory, useClass: MockLoggerFactory},
        {provide: PageContentService, useClass: MockPageContentService},
        {provide: PageService, useClass: MockPageService},
        {provide: UrlService, useClass: MockUrlService},
        {provide: WalksAndEventsService, useClass: MockWalksAndEventsService},
        {provide: StringUtilsService, useClass: MockStringUtilsService}
      ]
    });
    service = TestBed.inject(EventDispatchService);
    pageService = TestBed.inject(PageService) as unknown as MockPageService;
    pageContentService = TestBed.inject(PageContentService) as unknown as MockPageContentService;
    urlService = TestBed.inject(UrlService) as unknown as MockUrlService;
    walksAndEventsService = TestBed.inject(WalksAndEventsService) as unknown as MockWalksAndEventsService;
  });

  it("prefers event lookup for Mongo identifiers before dynamic content fallback", async () => {
    const path = "/walks/689667240ac482029442c7bd";
    urlService.setPath(path);
    pageService.value = path.substring(1);
    pageContentService.response = null;
    const expectedEvent = {groupEvent: {title: "Mongo walk"}} as ExtendedGroupEvent;
    walksAndEventsService.response = expectedEvent;

    const result = await service.eventView(notify, "Walk");
    expect(result.eventView).toBe(EventViewDispatch.PENDING);
    expect(walksAndEventsService.queryById).toHaveBeenCalledWith("689667240ac482029442c7bd");
    await expectAsync(result.event).toBeResolvedTo(expectedEvent);
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it("renders dynamic content for nested walk pages without identifiers", async () => {
    const path = "/walks/weekends-away/shropshire-may-2025";
    urlService.setPath(path);
    pageService.value = path.substring(1);
    pageContentService.response = null;

    const result = await service.eventView(notify, "Walk");
    expect(result.eventView).toBe(EventViewDispatch.DYNAMIC_CONTENT);
    expect(walksAndEventsService.queryById).not.toHaveBeenCalled();
  });

  it("renders walk listing when only area path is supplied", async () => {
    const path = "/walks";
    urlService.setPath(path);
    pageService.value = path.substring(1);

    const result = await service.eventView(notify, "Walk");
    expect(result.eventView).toBe(EventViewDispatch.LIST);
  });
});
