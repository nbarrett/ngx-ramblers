import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ReplaySubject } from "rxjs";
import { filter } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class BroadcastService<T> {
  private logger: Logger;
  private readonly subject: ReplaySubject<NamedEvent<T>>;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BroadcastService, NgxLoggerLevel.OFF);
    this.subject = new ReplaySubject<NamedEvent<T>>();
  }

  broadcast(event: NamedEvent<T>): void {
    this.logger.debug("broadcasting:event:", event);
    this.subject.next(event);
  }

  on(eventName: NamedEventType, callback: (data?: NamedEvent<T>) => void) {
    return this.subject.asObservable().pipe(
      filter((event: NamedEvent<T>) => {
        const found = event.name === eventName;
        if (found) {
          this.logger.debug("filtering for event", event, eventName, "found:", found,);
        }
        return found;
      })
    ).subscribe(callback);
  }
}


