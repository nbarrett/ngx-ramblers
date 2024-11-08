import { Injectable } from "@angular/core";
import * as icons from "@fortawesome/free-solid-svg-icons";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { KeyValue } from "../../functions/enums";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { FontAwesomeIcon } from "../../models/images.model";
import {
  faBan,
  faCircleCheck,
  faCircleInfo,
  faCirclePlus,
  faPencil,
  faRemove, faThumbsUp
} from "@fortawesome/free-solid-svg-icons";

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
    this.logger = loggerFactory.createLogger(IconService, NgxLoggerLevel.WARN);
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

  public toFontAwesomeIcon(status: string): FontAwesomeIcon {
    if (status === "cancelled") {
      return {icon: faBan, class: "red-icon"};
    }
    if (status === "created") {
      return {icon: faCirclePlus, class: "green-icon"};
    }
    if (status === "complete" || status === "summary") {
      return {icon: faCircleCheck, class: "green-icon"};
    }
    if (status === "success") {
      return {icon: faCircleCheck, class: "green-icon"};
    }
    if (status === "found") {
      return {icon: faCircleCheck, class: "green-icon"};
    }
    if (status === "info") {
      return {icon: faCircleInfo, class: "blue-icon"};
    }
    if (status === "updated") {
      return {icon: faPencil, class: "green-icon"};
    }
    if (status === "error") {
      return {icon: faRemove, class: "red-icon"};
    }
    if (status === "not-found") {
      return {icon: faRemove, class: "red-icon"};
    }
    if (status === "skipped") {
      return {icon: faThumbsUp, class: "green-icon"};
    }
    this.logger.warn("no icon for status:", status);
    return {icon: faCircleInfo, class: "blue-icon"};
  }

}
