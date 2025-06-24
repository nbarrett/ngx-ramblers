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
  private logger: Logger = inject(LoggerFactory).createLogger("EventDispatchService", NgxLoggerLevel.INFO);
  private pageContentService: PageContentService = inject(PageContentService);
  private pageService = inject(PageService);
  protected urlService: UrlService = inject(UrlService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected stringUtils = inject(StringUtilsService);
  protected socialEvent: ExtendedGroupEvent;

  async eventView(notify: AlertInstance, eventType: string): Promise<EventViewDispatchWithEvent> {
    const path = this.pageService.contentPath();
    const pathSegments = this.urlService.pathSegments();
    try {
      const pageContent = await this.pageContentService.findByPath(path);
      this.logger.info("Processing path:", path, "with", this.stringUtils.pluraliseWithCount(pathSegments.length, "path segment"), ":", pathSegments, "pageContent:", pageContent);
      if (pageContent || (pathSegments.length > 2 && !pageContent)) {
        this.logger.info("Dynamic content", pageContent ? "" : "was not", "found for path:", path, "content:", pageContent);
        return {eventView: EventViewDispatch.DYNAMIC_CONTENT};
      } else if (pathSegments.length === 1) {
        this.logger.info("rendering event list given path:", path);
        return {eventView: EventViewDispatch.LIST};
      } else {
        const eventId = this.urlService.lastPathSegment();
        this.logger.info("event id or slug found:", eventId, "invoking query");
        return {eventView: EventViewDispatch.PENDING, event: this.query(notify, eventId, eventType)};
      }
    } catch (error) {
      this.logger.error("Error fetching page content for path:", path, "error:", error, "eventView:", EventViewDispatch.LIST);
      this.notifyNotFound(eventType, null, notify);
      return {eventView: EventViewDispatch.LIST};
    }

  }

  private async query(notify: AlertInstance, eventId: string, eventType: string): Promise<ExtendedGroupEvent> {
    if (this.urlService.pathContainsEventIdOrSlug()) {
      const extendedGroupEvent: ExtendedGroupEvent = await this.walksAndEventsService.queryById(eventId);
      if (extendedGroupEvent) {
        this.logger.info(eventType + " found:", extendedGroupEvent);
        this.socialEvent = extendedGroupEvent;
      } else {
        this.notifyNotFound(eventType, eventId, notify);
      }
      return extendedGroupEvent;
    } else {
      return null;
    }
  }

  private notifyNotFound(eventType: string, eventId: string, notify: AlertInstance) {
    this.logger.warn(eventType + " not found:", eventId);
    notify.warning({
      title: eventType + " not found",
      message: "Content for this event doesn't exist"
    });
  }
}
