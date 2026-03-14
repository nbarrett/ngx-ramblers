import { TestBed } from "@angular/core/testing";
import { expect, vi } from "vitest";
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
            info() { },
            debug() { },
            warn() { },
            error() { },
            off() { }
        };
    }
}

class MockPageContentService {
    response: any = null;
    findByPath = vi.fn().mockImplementation(() => Promise.resolve(this.response));
}

class MockPageService {
    value = "";
    contentPath = vi.fn().mockImplementation(() => this.value);
}

class MockWalksAndEventsService {
    response: any = null;
    queryById = vi.fn().mockImplementation(() => Promise.resolve(this.response));
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
    const notify = { warning: vi.fn() } as unknown as AlertInstance;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                EventDispatchService,
                { provide: LoggerFactory, useClass: MockLoggerFactory },
                { provide: PageContentService, useClass: MockPageContentService },
                { provide: PageService, useClass: MockPageService },
                { provide: UrlService, useClass: MockUrlService },
                { provide: WalksAndEventsService, useClass: MockWalksAndEventsService },
                { provide: StringUtilsService, useClass: MockStringUtilsService }
            ]
        });
        service = TestBed.inject(EventDispatchService);
        pageService = TestBed.inject(PageService) as unknown as MockPageService;
        pageContentService = TestBed.inject(PageContentService) as unknown as MockPageContentService;
        urlService = TestBed.inject(UrlService) as unknown as MockUrlService;
        walksAndEventsService = TestBed.inject(WalksAndEventsService) as unknown as MockWalksAndEventsService;
    });

    it("renders walk listing when only area path is supplied", async () => {
        const path = "/walks";
        urlService.setPath(path);
        pageService.value = path.substring(1);

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.LIST);
        expect(walksAndEventsService.queryById).not.toHaveBeenCalled();
    });

    it("looks up event first for two-segment paths with mongo id", async () => {
        const path = "/walks/689667240ac482029442c7bd";
        urlService.setPath(path);
        pageService.value = path.substring(1);
        const expectedEvent = { groupEvent: { title: "Mongo walk" } } as ExtendedGroupEvent;
        walksAndEventsService.response = expectedEvent;

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.VIEW);
        expect(walksAndEventsService.queryById).toHaveBeenCalledWith("689667240ac482029442c7bd");
        await expect(result.event).resolves.toEqual(expectedEvent);
    });

    it("looks up event first for two-segment slug paths", async () => {
        const path = "/walks/canterbury-christmas-carols-monday-23rd-dec-social";
        urlService.setPath(path);
        pageService.value = path.substring(1);
        const expectedEvent = { groupEvent: { title: "Canterbury Christmas Carols" } } as ExtendedGroupEvent;
        walksAndEventsService.response = expectedEvent;

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.VIEW);
        expect(walksAndEventsService.queryById).toHaveBeenCalledWith("canterbury-christmas-carols-monday-23rd-dec-social");
        await expect(result.event).resolves.toEqual(expectedEvent);
    });

    it("tries page content first for deep paths and renders dynamic content when found", async () => {
        const path = "/walks/weekends-away/swanage-april-2023/day-2";
        urlService.setPath(path);
        pageService.value = path.substring(1);
        pageContentService.response = { path: "walks/weekends-away/swanage-april-2023/day-2" };

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.DYNAMIC_CONTENT);
        expect(walksAndEventsService.queryById).not.toHaveBeenCalled();
        expect(pageContentService.findByPath).toHaveBeenCalledWith("walks/weekends-away/swanage-april-2023/day-2");
    });

    it("falls back to event lookup for deep paths when no page content exists", async () => {
        const path = "/walks/weekends-away/shropshire-may-2025/friday-night-dinner-walking-weekend-church-stretton";
        urlService.setPath(path);
        pageService.value = path.substring(1);
        pageContentService.response = null;
        const expectedEvent = { groupEvent: { title: "Friday Night Dinner" } } as ExtendedGroupEvent;
        walksAndEventsService.response = expectedEvent;

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.VIEW);
        expect(pageContentService.findByPath).toHaveBeenCalledWith("walks/weekends-away/shropshire-may-2025/friday-night-dinner-walking-weekend-church-stretton");
        expect(walksAndEventsService.queryById).toHaveBeenCalledWith("friday-night-dinner-walking-weekend-church-stretton");
        await expect(result.event).resolves.toEqual(expectedEvent);
    });

    it("renders dynamic content for nested walk pages with no event or page content", async () => {
        const path = "/walks/weekends-away/shropshire-may-2025";
        urlService.setPath(path);
        pageService.value = path.substring(1);
        walksAndEventsService.response = null;
        pageContentService.response = null;

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.DYNAMIC_CONTENT);
    });

    it("falls through to dynamic content when event lookup returns null for two-segment path", async () => {
        const path = "/walks/nonexistent-event-slug";
        urlService.setPath(path);
        pageService.value = path.substring(1);
        walksAndEventsService.response = null;
        pageContentService.response = { path: "walks/nonexistent-event-slug" };

        const result = await service.eventView(notify, "Walk");
        expect(result.eventView).toBe(EventViewDispatch.DYNAMIC_CONTENT);
        expect(walksAndEventsService.queryById).toHaveBeenCalledWith("nonexistent-event-slug");
    });
});
