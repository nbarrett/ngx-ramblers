import debug from "debug";
import { Duration } from "luxon";
import { dateTimeNowAsValue } from "./dates";

export function formatDuration(ms: number): string {
  const duration = Duration.fromMillis(ms);
  const seconds = duration.as("seconds");
  if (ms <= 0) {
    return "0 secs";
  } else if (seconds < 1) {
    return `${ms}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(2)} secs`;
  } else if (seconds < 3600) {
    const minutes = duration.as("minutes");
    return `${minutes.toFixed(1)} mins`;
  } else if (seconds < 86400) {
    const hours = Math.floor(duration.as("hours"));
    const minutes = Math.round(duration.as("minutes") % 60);
    return minutes > 0 ? `${hours} hours ${minutes} mins` : `${hours} hours`;
  } else {
    const days = Math.floor(duration.as("days"));
    const hours = Math.floor(duration.as("hours") % 24);
    const minutes = Math.round(duration.as("minutes") % 60);
    let result = `${days} days`;
    if (hours > 0) {
      result += ` ${hours} hours`;
    }
    if (minutes > 0) {
      result += ` ${minutes} mins`;
    }
    return result;
  }
}

export class ProcessTimer {
  private startTime: number;
  private debugLog: debug.Debugger | null;
  private processName: string;

  constructor(processName: string, debugLog?: debug.Debugger) {
    this.processName = processName;
    this.startTime = dateTimeNowAsValue();
    this.debugLog = debugLog || null;
    if (this.debugLog) {
      this.debugLog(`${this.processName}:started`);
    }
  }

  elapsed(): number {
    return dateTimeNowAsValue() - this.startTime;
  }

  elapsedFormatted(): string {
    return formatDuration(this.elapsed());
  }

  log(message: string): void {
    if (this.debugLog) {
      this.debugLog(`${this.processName}:${message} (${this.elapsedFormatted()})`);
    }
  }

  complete(message?: string): string {
    const elapsed = this.elapsedFormatted();
    const completeMessage = message
      ? `${this.processName}:${message} in ${elapsed}`
      : `${this.processName}:completed in ${elapsed}`;
    if (this.debugLog) {
      this.debugLog(completeMessage);
    }
    return completeMessage;
  }

  reset(): void {
    this.startTime = dateTimeNowAsValue();
  }

  toString(): string {
    return this.elapsedFormatted();
  }
}

export function createProcessTimer(processName: string, debugLog?: debug.Debugger): ProcessTimer {
  return new ProcessTimer(processName, debugLog);
}
