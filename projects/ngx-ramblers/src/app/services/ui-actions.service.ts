import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { isObject, isString, kebabCase } from "es-toolkit/compat";
import { StoredValue, StoredValueQueryParameters } from "../models/ui-actions";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { booleanOf as sharedBooleanOf } from "../functions/strings";

@Injectable({
  providedIn: "root"
})
export class UiActionsService {

  private logger: Logger = inject(LoggerFactory).createLogger("UiActionsService", NgxLoggerLevel.ERROR);
  private router = inject(Router);

  queryParameter(parameter: StoredValue): string | null {
    return this.router.routerState.snapshot.root.queryParamMap.get(parameter);
  }

  updateQueryParameter(parameter: StoredValue, value: string | number | boolean | null, replaceUrl = true): Promise<boolean> {
    return this.updateQueryParameters({[parameter]: value}, replaceUrl);
  }

  private queryParameterNavigation: Promise<boolean> = Promise.resolve(true);

  updateQueryParameters(parameters: StoredValueQueryParameters, replaceUrl = true): Promise<boolean> {
    this.logger.debug("updateQueryParameters:", parameters, "replaceUrl:", replaceUrl);
    this.queryParameterNavigation = this.queryParameterNavigation
      .catch(() => false)
      .then(() => this.router.navigate([], {queryParams: parameters, queryParamsHandling: "merge", replaceUrl}));
    return this.queryParameterNavigation;
  }

  queryValueAliasFor(value: string): string {
    return kebabCase(value);
  }

  queryValueForAlias(alias: string | null, allowedValues: string[]): string | null {
    return alias ? allowedValues.find(value => value === alias || kebabCase(value) === alias) || null : null;
  }

  private storedValue(parameter: string): string | null {
    try {
      return localStorage.getItem(parameter);
    } catch (error) {
      this.logger.warn("local storage unavailable when reading", parameter, error);
      return null;
    }
  }

  initialValueFor(parameter: string, defaultValue?: any): string {
    const localStorageValue = this.storedValue(parameter);
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
      try {
        localStorage.setItem(parameter, storedValue);
      } catch (error) {
        this.logger.warn("local storage unavailable when saving", parameter, error);
      }
    } else {
      this.logger.error("saveValueFor:no parameter value supplied for value:", value);
    }
  }

  removeItemFor(parameter: string) {
    this.logger.debug("removing value for:", parameter);
    try {
      localStorage.removeItem(parameter);
    } catch (error) {
      this.logger.warn("local storage unavailable when removing", parameter, error);
    }
  }

  itemExistsFor(parameter: string): boolean {
    const exists = !!this.storedValue(parameter);
    this.logger.debug("item exists for:", parameter, "->", exists);
    return exists;
  }

  removeStoredValueIfTrue(storedValue: StoredValue) {
    const currentValue = this.initialBooleanValueFor(storedValue);
    if (currentValue) {
      this.removeItemFor(storedValue);
    }
  }

  booleanOf(value: any, fallback: boolean = false): boolean {
    const resolved = sharedBooleanOf(value, fallback);
    this.logger.debug("booleanOf:value:", value, typeof value, "returning:", resolved);
    return resolved;
  }
}
