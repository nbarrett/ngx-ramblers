import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ScrollPositionService {

  private logger: Logger = inject(LoggerFactory).createLogger("ScrollPositionService", NgxLoggerLevel.ERROR);
  private retained: number = null;

  public retain(): void {
    this.retained = window.scrollY;
    this.logger.debug("retain:", this.retained);
  }

  public restore(): void {
    const target = this.retained;
    this.retained = null;
    if (target === null) {
      this.logger.debug("restore: nothing retained");
    } else {
      setTimeout(() => window.scrollTo({top: target}));
    }
  }

  public clear(): void {
    this.retained = null;
  }
}
