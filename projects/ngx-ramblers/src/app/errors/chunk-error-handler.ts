import { ErrorHandler, inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { DateUtilsService } from "../services/date-utils.service";

@Injectable()
export class ChunkErrorHandler implements ErrorHandler {

  private logger: Logger = inject(LoggerFactory).createLogger("ChunkErrorHandler", NgxLoggerLevel.ERROR);
  private dateUtils: DateUtilsService = inject(DateUtilsService);

  handleError(error: unknown): void {
    const resolved = this.resolveError(error);
    if (this.isChunkLoadError(resolved)) {
      const storageKey = `chunk-reload-${location.pathname}`;
      const lastReload = Number(sessionStorage.getItem(storageKey) || "0");
      const now = this.dateUtils.dateTimeNowAsValue();
      if (now - lastReload > 10000) {
        this.logger.error("ChunkLoadError detected — reloading to fetch updated chunks");
        sessionStorage.setItem(storageKey, String(now));
        location.reload();
      } else {
        this.logger.error("ChunkLoadError detected but reload already attempted recently — skipping to prevent loop");
      }
    } else {
      this.logger.error("Unhandled error:", resolved);
    }
  }

  private resolveError(error: unknown): unknown {
    return (error as { rejection?: unknown })?.rejection || error;
  }

  private isChunkLoadError(error: unknown): boolean {
    return (error as { name?: string })?.name === "ChunkLoadError";
  }

}
