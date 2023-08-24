import { Injectable } from "@angular/core";
import isNaN from "lodash-es/isNaN";
import isNumber from "lodash-es/isNumber";
import { NgxLoggerLevel } from "ngx-logger";
import { chain } from "../functions/chain";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class NumberUtilsService {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(NumberUtilsService, NgxLoggerLevel.OFF);
  }

  sumValues(items: any[], fieldName) {
    if (!items) {
      return 0;
    }
    return chain(items).map(fieldName).reduce((memo, num) => {
      return memo + this.asNumber(num);
    }, 0).value();
  }

  generateUid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r: number = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  asNumber(numberString?: any, decimalPlaces?: number): number {
    this.logger.info("asNumber:", numberString, "decimalPlaces:", decimalPlaces);
    if (!numberString) {
      return 0;
    }
    const numberArgumentSupplied: boolean = isNumber(numberString);
    const decimalPlacesSupplied: boolean = isNumber(decimalPlaces);
    if (numberArgumentSupplied && !decimalPlacesSupplied) {
      return numberString;
    }
    const numberValue: string = numberArgumentSupplied ? numberString : parseFloat(numberString.replace(/[^\d\.\-]/g, ""));
    if (isNaN(numberValue)) {
      return 0;
    }
    const returnValue: number = decimalPlacesSupplied ? +parseFloat(numberValue).toFixed(decimalPlaces) : parseFloat(numberValue);
    this.logger.debug("asNumber:", numberString, decimalPlaces, "->", returnValue);
    return returnValue;
  }

  humanFileSizeOther(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + " B";
    }

    const units = si
      ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
      : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    let u = -1;
    const r = 10 ** dp;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + " " + units[u];
  }

  humanFileSizeMbOnly(size: number) {
    return this.asNumber(size / 1024 / 1024, 2) + " mb";
  }

  humanFileSize(size) {
    if (size < 1024) {
      return size + " b";
    }
    const i = Math.floor(Math.log(size) / Math.log(1024));
    let num: string | number = (size / Math.pow(1024, i));
    const round = Math.round(num);
    num = round < 10 ? num.toFixed(2) : round < 100 ? num.toFixed(1) : round;
    return `${num} ${"kmgtpezy"[i - 1]}b`;
  }
}
