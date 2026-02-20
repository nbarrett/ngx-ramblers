import { HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import {
  escapeRegExp,
  isArray,
  isBoolean,
  isEmpty,
  isNull,
  isNumber,
  isObject,
  isUndefined,
  map,
  startCase,
  toLower,
  words
} from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertMessage } from "../models/alert-target.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { booleanOf as sharedBooleanOf, toKebabCase } from "../functions/strings";
import he from "he";

@Injectable({
  providedIn: "root"
})
export class
StringUtilsService {

  private logger: Logger = inject(LoggerFactory).createLogger("StringUtilsService", NgxLoggerLevel.ERROR);

  replaceAll(find: any, replace: any, str: any): string | number {
    const regex = new RegExp(escapeRegExp("" + find), "g");
    const stabilize = (current: string): string => {
      const next = current.replace(regex, replace);
      return next === current ? current : stabilize(next);
    };
    const replacedValue = stabilize("" + str);
    return isNumber(str) ? +replacedValue : replacedValue;
  }

  asBoolean(val: any): boolean {
    return sharedBooleanOf(val);
  }

  noValueFor(dataValue: any): boolean {
    return !isBoolean(dataValue) && (isEmpty(dataValue) || isUndefined(dataValue) || isNull(dataValue));
  }

  decodeString(encodedString: string) {
    const decodedString = encodedString ? he.decode(encodedString) : encodedString;
    this.logger.info("decodeString:encodedString:", encodedString, "decodedString:", decodedString);
    return decodedString;
  }

  stringify(message): string {
    let returnValue;
    const extractedMessage = this.isAlertMessage(message) ? message.message : message;
    if (extractedMessage instanceof TypeError || extractedMessage instanceof Error) {
      returnValue = extractedMessage.toString();
    } else if (extractedMessage instanceof HttpErrorResponse) {
      const messageToStringify = {message: extractedMessage.message, error: extractedMessage.error};
      this.logger.error("error is instanceof HttpErrorResponse:extractedMessage:", extractedMessage, "messageToStringify:", messageToStringify);
      returnValue = extractedMessage.statusText + " - " + this.stringifyObject(messageToStringify);
    } else if (extractedMessage?.error?.message) {
      returnValue = extractedMessage?.error?.message + (extractedMessage?.error?.error ? " - " + extractedMessage?.error?.error : "");
    } else if (extractedMessage?.error?.errmsg) {
      returnValue = extractedMessage?.error?.errmsg + (extractedMessage?.error?.error ? " - " + extractedMessage?.error?.error : "");
    } else if (isObject(extractedMessage)) {
      returnValue = this.stringifyObject(extractedMessage);
    } else {
      returnValue = extractedMessage;
    }

    this.logger.debug("stringify:message", message, "extractedMessage:", extractedMessage, "returnValue:", returnValue);
    return returnValue;
  }

  censor(censor) {
    const maxSerializationDepth = 30;
    let i = 0;

    return (key, value) => {
      if (i !== 0 && isObject(censor) && isObject(value) && censor === value) {
        return "[Circular]";
      }

      if (i >= maxSerializationDepth - 1) {
        return "[Unknown]";
      }

      ++i;

      return value;
    };
  }

  stringifyObject(inputValue: any, defaultValue?: string): string {
    if (isObject(inputValue)) {
      return map(inputValue, (value, key) => {
        if (isObject(value)) {
          return `${startCase(key)} -> ${this.stringifyObject(value, defaultValue)}`;
        } else {
          return `${startCase(key)}: ${(this.stringifiedValue(value, defaultValue))}`;
        }
      }).sort().join(", ");
    } else {
      return this.stringifiedValue(inputValue, defaultValue);
    }
  }

  private stringifiedValue(value: any, defaultValue: string): string {
    if (isBoolean(value)) {
      return value.toString();
    }
    if (isNull(value) || isUndefined(value) || value === "") {
      return defaultValue || "(none)";
    }
    return value;
  }

  isAlertMessage(message: any): message is AlertMessage {
    return message?.message && message?.title;
  }

  stripLineBreaks(str, andTrim: boolean) {
    const replacedValue = str.replace(/(\r\n|\n|\r)/gm, "");
    return andTrim && replacedValue ? replacedValue.trim() : replacedValue;
  }

  truncate(str: string, chars: number = 20) {
    return str ? this.left(str, chars) + (str.length > chars ? "..." : "") : "";
  }

  left(str: string, chars: number): string {
    return str.slice(0, chars);
  }

  right(str: string, chars: number): string {
    return str.slice(-chars);
  }

  asTitle(str: string) {
    return startCase(toLower(str));
  }

  asWords(str: string) {
    return words(str).join(" ");
  }

  pluraliseWithCount(count: number, singular: string, plural?: string) {
    return `${count} ${this.pluralise(count, singular, plural)}`;
  }

  pluralise(count: number, singular: string, plural?: string) {
    return `${count === 1 ? singular : plural || (singular + "s")}`;
  }

  arrayFromDelimitedData(items: string[] | string) {
    return items ? isArray(items) ? items : items.split(",").map(item => item.trim()) : [];
  }

  kebabCase(...strings: any[]): string {
    const returnValue = toKebabCase(strings);
    this.logger.debug("input:", strings, "output:", returnValue);
    return returnValue;
  }

  lastItemFrom(key: string): string {
    return key?.split("/").filter(item => item)?.pop();
  }

  stripMarkdown(text: string): string {
    if (!text) {
      return text;
    } else {
    return text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/^\s*>\s+/gm, "")
      .trim();
    }
  }

}
