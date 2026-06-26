import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ReplaySubject } from "rxjs";
import { filter } from "rxjs/operators";
import { isUndefined } from "es-toolkit/compat";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class BroadcastService<T> {
  private logger: Logger = inject(LoggerFactory).createLogger("BroadcastService", NgxLoggerLevel.ERROR);
  private readonly subject = new ReplaySubject<NamedEvent<T>>();
  private readonly crossTabEventNames: NamedEventType[] = [NamedEventType.MAIL_LISTS_CHANGED, NamedEventType.MAIL_SUBSCRIPTION_CHANGED];
  private readonly crossTabChannel: BroadcastChannel | null = !isUndefined(globalThis.BroadcastChannel) ? new BroadcastChannel("ngx-ramblers-broadcast") : null;

  constructor() {
    if (this.crossTabChannel) {
      this.crossTabChannel.onmessage = (message: MessageEvent<{ name: NamedEventType }>) => {
        this.logger.debug("cross-tab event received:", message.data);
        this.subject.next(NamedEvent.named(message.data?.name) as NamedEvent<T>);
      };
    }
  }

  broadcast(event: NamedEvent<T>): void {
    this.logger.debug("broadcasting:event:", event);
    this.subject.next(event);
    if (this.crossTabChannel && this.crossTabEventNames.includes(event.name)) {
      try {
        this.crossTabChannel.postMessage({name: event.name});
      } catch (error) {
        this.logger.warn("cross-tab broadcast failed:", error);
      }
    }
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


