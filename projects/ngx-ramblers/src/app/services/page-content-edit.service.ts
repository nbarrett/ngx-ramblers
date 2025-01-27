import { inject, Injectable } from "@angular/core";
import { isEqual } from "lodash-es";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentEditEvent } from "../models/content-text.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class PageContentEditService {

  private logger: Logger = inject(LoggerFactory).createLogger("PageContentEditService", NgxLoggerLevel.ERROR);

  handleEvent(pageContentEditEvent: PageContentEditEvent, pageContentEditEvents: PageContentEditEvent[]): PageContentEditEvent[] {
    const output: PageContentEditEvent[] = [];
    if (this.eventMatching(pageContentEditEvents, pageContentEditEvent)) {
      output.push(...pageContentEditEvents.map(item => this.matchingOnAddress(pageContentEditEvent, item) ? pageContentEditEvent : item));
      this.logger.info("received pageContentEditEvent:", pageContentEditEvent, "updated in:", output);
    } else {
      output.push(pageContentEditEvent, ...pageContentEditEvents);
      this.logger.info("received pageContentEditEvent:", pageContentEditEvent, "added to", pageContentEditEvents);
    }
    return output;
  }

  eventMatching(pageContentEditEvents: PageContentEditEvent[], pageContentEditEvent: PageContentEditEvent): PageContentEditEvent {
    return pageContentEditEvents.find((item => this.matchingOnAddress(pageContentEditEvent, item)));
  }

  private matchingOnAddress(item1: PageContentEditEvent, item2: PageContentEditEvent): boolean {
    return isEqual({...item1, editActive: null, image: null}, {...item2, editActive: null, image: null});
  }

}
