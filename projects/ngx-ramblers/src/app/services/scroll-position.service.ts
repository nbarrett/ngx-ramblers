import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ScrollPositionService {

  private logger: Logger = inject(LoggerFactory).createLogger("ScrollPositionService", NgxLoggerLevel.ERROR);
  private retained: number = null;
  private retainedElementY: number = null;
  private retainedMapsWindow: {filterKey: string; limit: number} = null;

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

  public retainFrom(element: HTMLElement, mapsWindow?: {filterKey: string; limit: number}): void {
    this.retainedElementY = element.scrollTop;
    this.retainedMapsWindow = mapsWindow || null;
    this.logger.debug("retainFrom:", this.retainedElementY, this.retainedMapsWindow);
  }

  public takeElement(): {y: number; mapsWindow: {filterKey: string; limit: number} | null} | null {
    const y = this.retainedElementY;
    const mapsWindow = this.retainedMapsWindow;
    this.retainedElementY = null;
    this.retainedMapsWindow = null;
    if (y === null) {
      this.logger.debug("takeElement: nothing retained");
      return null;
    } else {
      return {y, mapsWindow};
    }
  }

  public restoreTo(element: HTMLElement): void {
    const saved = this.takeElement();
    if (saved) {
      setTimeout(() => element.scrollTo({top: saved.y}));
    }
  }

  public clear(): void {
    this.retained = null;
    this.retainedElementY = null;
    this.retainedMapsWindow = null;
  }
}
