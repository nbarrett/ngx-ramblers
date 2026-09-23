import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { eventSlug } from "../../functions/walks/event-slug";
import { EVENT_SLUG_SELECT } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalksAndEventsService } from "./walks-and-events.service";

@Injectable({
  providedIn: "root"
})
export class EventSlugResolverService {

  private logger: Logger = inject(LoggerFactory).createLogger("EventSlugResolverService", NgxLoggerLevel.ERROR);
  private walksAndEventsService = inject(WalksAndEventsService);
  private slugs = new Map<string, string>();
  private pending = new Set<string>();
  private inFlight = new Set<string>();

  slugOrId(eventId: string): string {
    if (eventId && !this.slugs.has(eventId) && !this.inFlight.has(eventId) && !this.pending.has(eventId)) {
      this.queue(eventId);
    }
    return this.slugs.get(eventId) || eventId;
  }

  private queue(eventId: string): void {
    const firstPending = this.pending.size === 0;
    this.pending.add(eventId);
    if (firstPending) {
      setTimeout(() => this.resolvePending());
    }
  }

  private resolvePending(): void {
    const eventIds = [...this.pending];
    this.pending.clear();
    eventIds.forEach(eventId => this.inFlight.add(eventId));
    this.walksAndEventsService.queryByIds(eventIds, EVENT_SLUG_SELECT)
      .then(events => eventIds.forEach(eventId => this.slugs.set(eventId, eventSlug(events.get(eventId)) || eventId)))
      .catch(error => {
        this.logger.error("could not resolve slugs for eventIds:", eventIds, error);
        eventIds.forEach(eventId => this.slugs.set(eventId, eventId));
      })
      .finally(() => eventIds.forEach(eventId => this.inFlight.delete(eventId)));
  }
}
