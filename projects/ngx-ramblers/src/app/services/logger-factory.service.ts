import { Injectable } from "@angular/core";
import { CustomNGXLoggerService, INGXLoggerConfig, NGXLogger, NgxLoggerLevel } from "ngx-logger";

export class Logger {
  constructor(private logger: NGXLogger, private className: string) {
  }

  private logPrefix() {
    return this.className + " -";
  }

  info(...additional: any[]) {
    this.logger.info(this.logPrefix(), ...additional);
  }

  log(...additional: any[]) {
    this.logger.log(this.logPrefix(), ...additional);
  }

  debug(...additional: any[]) {
    this.logger.debug(this.logPrefix(), ...additional);
  }

  error(...additional: any[]) {
    this.logger.error(this.logPrefix(), ...additional);
  }

  warn(...additional: any[]) {
    this.logger.warn(this.logPrefix(), ...additional);
  }

  off(...additional: any[]) {
  }

}

@Injectable({
  providedIn: "root"
})

export class LoggerFactory {

  constructor(private customLogger: CustomNGXLoggerService) {
  }

  createLogger<T extends InstanceType<any>>(classRef: T | string, loggerConfig: NgxLoggerLevel): Logger {
    const config: INGXLoggerConfig = {level: loggerConfig};
    return new Logger(this.customLogger.create(config), typeof classRef === "string" ? classRef : classRef["name"]);
  }

}

