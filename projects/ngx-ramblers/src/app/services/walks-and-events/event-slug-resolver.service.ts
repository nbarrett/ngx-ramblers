import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { eventSlug } from "../../functions/walks/event-slug";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalksAndEventsService } from "./walks-and-events.service";

@Injectable({
  providedIn: "root"
})
export class EventSlugResolverService {

  private logger: Logger = inject(LoggerFactory).createLogger("EventSlugResolverService", NgxLoggerLevel.ERROR);
  private walksAndEventsService = inject(WalksAndEventsService);
  private slugs = new Map<string, string>();
  private lookups = new Map<string, Promise<string>>();

  slugOrId(eventId: string): string {
    if (eventId && !this.slugs.has(eventId)) {
      this.resolve(eventId);
    }
    return this.slugs.get(eventId) || eventId;
  }

  private resolve(eventId: string): Promise<string> {
    const existing = this.lookups.get(eventId);
    if (existing) {
      return existing;
    } else {
      const lookup = this.walksAndEventsService.queryById(eventId)
        .then(event => {
          const slug = eventSlug(event) || eventId;
          this.slugs.set(eventId, slug);
          this.logger.info("resolved eventId:", eventId, "to slug:", slug);
          return slug;
        })
        .catch(error => {
          this.slugs.set(eventId, eventId);
          this.logger.error("could not resolve slug for eventId:", eventId, error);
          return eventId;
        })
        .finally(() => this.lookups.delete(eventId));
      this.lookups.set(eventId, lookup);
      return lookup;
    }
  }
}
