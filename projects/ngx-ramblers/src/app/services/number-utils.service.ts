import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { asNumber, estimateObjectSize, generateUid, readableFileSize, sumValues } from "../functions/numbers";

@Injectable({
  providedIn: "root"
})
export class NumberUtilsService {

  private logger: Logger = inject(LoggerFactory).createLogger("NumberUtilsService", NgxLoggerLevel.ERROR);

  sumValues(items: any[], fieldName: string) {
    return sumValues(items, fieldName);
  }

  generateUid() {
    return generateUid();
  }

  asNumber(numberString?: any, decimalPlaces?: number): number {
    this.logger.info("asNumber:", numberString, "decimalPlaces:", decimalPlaces);
    const returnValue = asNumber(numberString, decimalPlaces);
    this.logger.debug("asNumber:", numberString, decimalPlaces, "->", returnValue);
    return returnValue;
  }

  estimateObjectSize(obj: any): number {
    return estimateObjectSize(obj);
  }

  humanFileSize(size: number) {
    return readableFileSize(size);
  }
}
