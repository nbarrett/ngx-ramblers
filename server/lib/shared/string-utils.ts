import escapeRegExp = require("lodash/escapeRegExp");
import isNumber = require("lodash/isNumber");

export const uidFormat = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

export function generateUid() {
  return uidFormat.replace(/[xy]/g, value => {
    const r = Math.random() * 16 | 0;
    const v = value === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function replaceAll(find: string, replace: string, str: string): string | number {
  let replacedValue;
  let initialValue = "" + str;
  while (true) {
    replacedValue = initialValue.replace(new RegExp(escapeRegExp("" + find), "g"), replace);
    if (replacedValue !== initialValue) {
      initialValue = replacedValue;
    } else {
      break;
    }
  }
  return isNumber(str) ? +replacedValue : replacedValue;
}

export function asBoolean(val: any): boolean {
  return val === true || ["true", "yes"].includes(val?.toString().toLowerCase());
}
