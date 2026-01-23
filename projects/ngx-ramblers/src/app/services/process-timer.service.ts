import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { DateUtilsService } from "./date-utils.service";

export class ProcessTimer {
  private startTime: number;
  private logger: Logger | null;
  private processName: string;
  private dateUtils: DateUtilsService;

  constructor(processName: string, dateUtils: DateUtilsService, logger?: Logger) {
    this.processName = processName;
    this.dateUtils = dateUtils;
    this.startTime = dateUtils.dateTimeNowAsValue();
    this.logger = logger || null;
    if (this.logger) {
      this.logger.info(`${this.processName}:started`);
    }
  }

  elapsed(): number {
    return this.dateUtils.dateTimeNowAsValue() - this.startTime;
  }

  elapsedFormatted(): string {
    return this.dateUtils.formatDuration(this.startTime, this.dateUtils.dateTimeNowAsValue());
  }

  log(message: string): void {
    if (this.logger) {
      this.logger.info(`${this.processName}:${message} (${this.elapsedFormatted()})`);
    }
  }

  complete(message?: string): string {
    const elapsed = this.elapsedFormatted();
    const completeMessage = message
      ? `${this.processName}:${message} in ${elapsed}`
      : `${this.processName}:completed in ${elapsed}`;
    if (this.logger) {
      this.logger.info(completeMessage);
    }
    return completeMessage;
  }

  reset(): void {
    this.startTime = this.dateUtils.dateTimeNowAsValue();
  }

  toString(): string {
    return this.elapsedFormatted();
  }
}

@Injectable({
  providedIn: "root"
})
export class ProcessTimerService {
  private logger: Logger = inject(LoggerFactory).createLogger("ProcessTimerService", NgxLoggerLevel.ERROR);
  private dateUtils: DateUtilsService = inject(DateUtilsService);

  createTimer(processName: string, logger?: Logger): ProcessTimer {
    return new ProcessTimer(processName, this.dateUtils, logger || this.logger);
  }
}
