import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { StoredValue } from "../models/ui-actions";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class UiActionsService {
  private logger: Logger;

  constructor(private dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(UiActionsService, NgxLoggerLevel.OFF);
  }

  initialValueFor(parameter: string, defaultValue?: any): string {
    const localStorageValue = localStorage.getItem(parameter);
    const value = localStorageValue || defaultValue;
    this.logger.debug("initial value for:", parameter, "localStorage:", localStorageValue, "default:", defaultValue, "is:", value);
    return value;
  }

  initialObjectValueFor<T>(parameter: string, defaultValue?: any): T {
    const value = this.initialValueFor(parameter, defaultValue);
    this.logger.debug("value", value);
    return typeof value === "string" ? JSON.parse(value) : defaultValue;
  }

  initialBooleanValueFor(parameter: string, defaultValue?: any): boolean {
    return this.booleanOf(this.initialValueFor(parameter, defaultValue));
  }

  saveValueFor(parameter: string, value?: any) {
    if (parameter) {
      const storedValue: string = typeof value === "object" ? JSON.stringify(value) : value.toString();
      this.logger.debug("saving value for:", parameter, "as:", storedValue);
      localStorage.setItem(parameter, storedValue);
    } else {
      this.logger.error("saveValueFor:no parameter value supplied for value:", value);
    }
  }

  removeItemFor(parameter: string) {
    this.logger.debug("removing value for:", parameter);
    localStorage.removeItem(parameter);
  }

  itemExistsFor(parameter: string): boolean {
    const exists = !!localStorage.getItem(parameter);
    this.logger.debug("item exists for:", parameter, "->", exists);
    return exists;
  }

  removeStoredValueIfTrue(storedValue: StoredValue) {
    const currentValue = this.initialBooleanValueFor(storedValue);
    if (currentValue) {
      this.removeItemFor(storedValue);
    }
  }

  booleanOf(value: string | boolean) {
    const returnedValue = typeof value === "boolean" ? value : (["true", "false"].includes(value)) ? value === "true" : false;
    this.logger.debug("booleanOf:value:", value, typeof value, "returning:", returnedValue);
    return returnedValue;
  }
}
