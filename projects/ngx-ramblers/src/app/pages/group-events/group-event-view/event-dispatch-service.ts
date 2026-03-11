import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentService } from "../../../services/page-content.service";
import { UrlService } from "../../../services/url.service";
import { PageService } from "../../../services/page.service";
import { EventViewDispatch, EventViewDispatchWithEvent, ExtendedGroupEvent } from "../../../models/group-event.model";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { AlertInstance } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Injectable({
  providedIn: "root"
})

export class EventDispatchService {
  private logger: Logger = inject(LoggerFactory).createLogger("EventDispatchService", NgxLoggerLevel.ERROR);
  private pageContentService: PageContentService = inject(PageContentService);
  private pageService = inject(PageService);
  protected urlService: UrlService = inject(UrlService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected stringUtils = inject(StringUtilsService);
  protected groupEvent: ExtendedGroupEvent;

  async eventView(notify: AlertInstance, eventType: string): Promise<EventViewDispatchWithEvent> {
    const path = this.pageService.contentPath();
    const pathSegments = this.urlService.pathSegments();
    try {
      this.logger.info("Processing path:", path, "with", this.stringUtils.pluraliseWithCount(pathSegments.length, "path segment"), ":", pathSegments);
      if (pathSegments.length === 1) {
        this.logger.info("rendering event list given path:", path);
        return {eventView: EventViewDispatch.LIST};
      }
      const eventId = this.urlService.lastPathSegment();
      if (pathSegments.length === 2) {
        this.logger.info("shallow path - trying event lookup first for slug:", eventId);
        const event = await this.walksAndEventsService.queryById(eventId);
        if (event) {
          this.logger.info("event found for slug:", eventId, "matched event title:", event?.groupEvent?.title, "url:", event?.groupEvent?.url, "id:", event?.id);
          this.groupEvent = event;
          return {eventView: EventViewDispatch.VIEW, event: Promise.resolve(event)};
        }
        this.logger.info("no event found for slug:", eventId, "trying page content lookup");
      } else {
        this.logger.info("deep path - trying page content first for path:", path);
        const pageContent = await this.pageContentService.findByPath(path);
        if (pageContent) {
          this.logger.info("Dynamic content found for path:", path);
          return {eventView: EventViewDispatch.DYNAMIC_CONTENT};
        }
        this.logger.info("no page content for path:", path, "trying event lookup for slug:", eventId);
        const event = await this.walksAndEventsService.queryById(eventId);
        if (event) {
          this.logger.info("event found for slug:", eventId, "matched event title:", event?.groupEvent?.title, "url:", event?.groupEvent?.url, "id:", event?.id);
          this.groupEvent = event;
          return {eventView: EventViewDispatch.VIEW, event: Promise.resolve(event)};
        }
      }
      const pageContent = await this.pageContentService.findByPath(path);
      if (pageContent) {
        this.logger.info("Dynamic content found for path:", path);
        return {eventView: EventViewDispatch.DYNAMIC_CONTENT};
      }
      this.logger.info("No event or page content found for path:", path);
      return {eventView: EventViewDispatch.DYNAMIC_CONTENT};
    } catch (error) {
      this.logger.error("Error fetching page content for path:", path, "error:", error, "eventView:", EventViewDispatch.LIST);
      this.notifyNotFound(eventType, null, notify);
      return {eventView: EventViewDispatch.LIST};
    }

  }

  private notifyNotFound(eventType: string, eventId: string, notify: AlertInstance) {
    this.logger.info(eventType + " not found:", eventId);
    notify.warning({
      title: eventType + " not found",
      message: "Content for this event doesn't exist"
    });
  }
}
