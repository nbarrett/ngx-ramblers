import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { isBoolean, isObject, isString } from "es-toolkit/compat";
import { StoredValue } from "../models/ui-actions";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class UiActionsService {

  private logger: Logger = inject(LoggerFactory).createLogger("UiActionsService", NgxLoggerLevel.ERROR);

  initialValueFor(parameter: string, defaultValue?: any): string {
    const localStorageValue = localStorage.getItem(parameter);
    const value = localStorageValue || defaultValue;
    this.logger.debug("initial value for:", parameter, "localStorage:", localStorageValue, "default:", defaultValue, "is:", value);
    return value;
  }

  initialObjectValueFor<T>(parameter: string, defaultValue?: any): T {
    const value = this.initialValueFor(parameter, defaultValue);
    this.logger.debug("value", value);
    return isString(value) ? JSON.parse(value) : defaultValue;
  }

  initialBooleanValueFor(parameter: string, defaultValue?: any): boolean {
    return this.booleanOf(this.initialValueFor(parameter, defaultValue));
  }

  saveValueFor(parameter: StoredValue, value?: any) {
    if (parameter) {
      const storedValue: string = isObject(value) ? JSON.stringify(value) : value?.toString();
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

  booleanOf(value: any, fallback: boolean = false) {
    const normalized = (value == null ? "" : value.toString()).trim().toLowerCase();
    const resolved = isBoolean(value)
      ? value
      : ["true", "1", "yes"].includes(normalized)
        ? true
        : ["false", "0", "no"].includes(normalized)
          ? false
          : fallback;
    this.logger.debug("booleanOf:value:", value, typeof value, "returning:", resolved);
    return resolved;
  }
}
