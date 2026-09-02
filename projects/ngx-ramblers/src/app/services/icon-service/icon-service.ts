import { inject, Injectable } from "@angular/core";
import * as solidIcons from "@fortawesome/free-solid-svg-icons";
import {
  faBan,
  faCircleCheck,
  faCircleInfo,
  faCirclePlus,
  faPencil,
  faRemove,
  faSpinner,
  faThumbsUp
} from "@fortawesome/free-solid-svg-icons";
import * as brandIcons from "@fortawesome/free-brands-svg-icons";
import { isString, map } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { KeyValue } from "../../functions/enums";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { FontAwesomeIcon } from "../../models/images.model";
import { MemberAction } from "../../models/member.model";
import { WalkStatus } from "../../models/ramblers-walks-manager";


@Injectable({
  providedIn: "root"
})
export class IconService {

  private logger: Logger = inject(LoggerFactory).createLogger("IconService", NgxLoggerLevel.ERROR);
  public iconArray: KeyValue<any>[] = [...this.iconEntries(solidIcons), ...this.iconEntries(brandIcons)];
  public iconValues: any[] = this.iconArray.map(item => item.value);
  public iconKeys: string[] = this.iconArray.map(item => item.key);
  private iconLookup: Map<string, KeyValue<any>> = new Map(this.iconArray.map(item => [(item.key || "").toLowerCase(), item]));

  constructor() {
    this.logger.debug("initialised with icons:", this.iconArray, "values:", this.iconValues, "keys:", this.iconKeys);
  }

  iconForName(iconName: string): any {
    if (iconName) {
      this.logger.debug("for iconName:", iconName);
      return this.iconLookup.get(iconName.toLowerCase())?.value;
    } else {
      return null;
    }
  }

  matchedKey(query: string): string | null {
    const term = (query || "").trim().toLowerCase();
    if (term) {
      const match = this.iconLookup.get(term);
      if (match) {
        return match.key;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  iconEntries(source: Record<string, any>): KeyValue<any>[] {
    return map(source, (value, key) => ({key, value}))
      .filter(item => isString(item.key) && item.key.startsWith("fa") && isString(item.value?.iconName));
  }

  matchingIcons(query: string): KeyValue<any>[] {
    const term = (query || "").trim().toLowerCase();
    if (!term) {
      return this.iconArray;
    } else if (term === "f" || term === "fa" || term === "fa-") {
      return [];
    } else {
      return this.iconArray.filter(item => {
        const key = (item.key || "").toLowerCase();
        const name = (item.value?.iconName || "").toLowerCase();
        return key.includes(term) || name.includes(term);
      });
    }
  }

  public toFontAwesomeIcon(status: string): FontAwesomeIcon {
    if (status === WalkStatus.CANCELLED) {
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
    if (status === MemberAction.matched) {
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
    if (status === "active") {
      return {icon: faSpinner, class: "yellow-icon fa-spin"};
    }
    this.logger.warn("no icon for status:", status);
    return {icon: faCircleInfo, class: "blue-icon"};
  }
}
