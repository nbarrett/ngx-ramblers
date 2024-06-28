import { Injectable } from "@angular/core";
import * as icons from "@fortawesome/free-solid-svg-icons";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { KeyValue } from "../../functions/enums";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class IconService {
  private logger: Logger;
  public iconArray: KeyValue<any>[] = [];
  public iconValues: any[] = [];
  public iconKeys: string[] = [];

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(IconService, NgxLoggerLevel.OFF);
    this.iconArray = map(icons, (value, key) => ({key, value}));
    this.iconValues = this.iconArray.map(item => item.value);
    this.iconKeys = this.iconArray.map(item => item.key);
    this.logger.debug("initialised with icons:", icons, this.iconArray, "values:", this.iconValues, "keys:", this.iconKeys);
  }

  iconForName(iconName: string): any {
    if (iconName) {
      this.logger.debug("for iconName:", iconName);
      const icon = this.iconArray.find(item => item?.key?.toLowerCase() === iconName?.toLowerCase());
      return icon?.value;
    }
  }
}
