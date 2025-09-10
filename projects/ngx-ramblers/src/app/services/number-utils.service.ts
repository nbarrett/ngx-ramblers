import { inject, Injectable } from "@angular/core";
import { isNaN } from "es-toolkit/compat";
import { isNumber } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { humanFileSize } from "../functions/file-utils";
import { isString } from "es-toolkit/compat";
import { isBoolean } from "es-toolkit/compat";
import { isArray } from "es-toolkit/compat";
import { isObject } from "es-toolkit/compat";
import { isUndefined } from "es-toolkit/compat";
import { isNull } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class NumberUtilsService {

  private logger: Logger = inject(LoggerFactory).createLogger("NumberUtilsService", NgxLoggerLevel.ERROR);

  sumValues(items: any[], fieldName: string) {
    if (!items) {
      return 0;
    }
    return items.map(item => item[fieldName]).reduce((memo, num) => {
      return memo + this.asNumber(num);
    }, 0);
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

  estimateObjectSize(obj: any): number {
    let size = 0;
    if (isNull(obj) || isUndefined(obj)) {
      return size;
    } else if (isString(obj)) {
      size = new TextEncoder().encode(obj).length;
    } else if (isNumber(obj)) {
      size = 8; // Approximate size for numbers (double precision)
    } else if (isBoolean(obj)) {
      size = 4; // Approximate size for booleans
    } else if (isArray(obj)) {
      size = obj.reduce((acc, item) => acc + this.estimateObjectSize(item), 0);
    } else if (isObject(obj)) {
      size = Object.values(obj).reduce((acc: number, value: any) => acc + this.estimateObjectSize(value), 0) as number;
    }
    return size;
  }

  humanFileSize(size: number) {
    return humanFileSize(size);
  }
}
