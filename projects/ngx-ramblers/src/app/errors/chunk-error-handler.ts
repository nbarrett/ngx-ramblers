import { ErrorHandler, inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

@Injectable()
export class ChunkErrorHandler implements ErrorHandler {

  private logger: Logger = inject(LoggerFactory).createLogger("ChunkErrorHandler", NgxLoggerLevel.ERROR);

  handleError(error: unknown): void {
    const resolved = this.resolveError(error);
    if (this.isChunkLoadError(error) || this.isChunkLoadError(resolved)) {
      const storageKey = "chunk-reload-" + location.pathname;
      if (!sessionStorage.getItem(storageKey)) {
        this.logger.error("ChunkLoadError detected — reloading to fetch updated chunks");
        sessionStorage.setItem(storageKey, "1");
        location.reload();
      } else {
        this.logger.error("ChunkLoadError detected but reload already attempted recently — skipping to prevent loop");
      }
    } else {
      this.logger.error("Unhandled error:", resolved);
    }
  }

  private resolveError(error: unknown): unknown {
    const wrapped = error as { rejection?: unknown; originalError?: unknown; error?: unknown };
    return wrapped?.rejection || wrapped?.originalError || wrapped?.error || error;
  }

  private isChunkLoadError(error: unknown): boolean {
    const name = (error as { name?: string })?.name || "";
    const message = (error as { message?: string })?.message || "";
    const text = `${name} ${message} ${String(error)}`;
    if (name === "ChunkLoadError") {
      return true;
    } else if (text.includes("Failed to fetch dynamically imported module")) {
      return true;
    } else if (text.includes("Importing a module script failed")) {
      return true;
    } else if (text.includes("Loading chunk")) {
      return true;
    } else if (text.includes("error loading dynamically imported module")) {
      return true;
    } else {
      return false;
    }
  }

}
