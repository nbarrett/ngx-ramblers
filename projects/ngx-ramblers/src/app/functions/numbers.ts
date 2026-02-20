import { isArray, isBoolean, isNull, isNumber, isObject, isString, isUndefined, values } from "es-toolkit/compat";
import { humanFileSize } from "./file-utils";

export function asNumber(value?: any, decimalPlaces?: number): number {
  if (!value) {
    return 0;
  }
  const hasNumericValue = isNumber(value);
  const decimalPlacesSupplied = isNumber(decimalPlaces);
  if (hasNumericValue && !decimalPlacesSupplied) {
    return value;
  }
  const numeric = hasNumericValue ? value : parseFloat(String(value).replace(/[^\d.\-]/g, ""));
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return decimalPlacesSupplied ? +parseFloat(String(numeric)).toFixed(decimalPlaces as number) : parseFloat(String(numeric));
}

export function sumValues(items: any[], fieldName: string): number {
  if (!items) {
    return 0;
  }
  return items
    .map(item => item?.[fieldName])
    .reduce((total, num) => total + asNumber(num), 0);
}

export function generateUid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const randomValue: number = Math.random() * 16 | 0;
    const value = character === "x" ? randomValue : (randomValue & 0x3 | 0x8);
    return value.toString(16);
  });
}

export function estimateObjectSize(obj: any): number {
  let size = 0;
  if (isNull(obj) || isUndefined(obj)) {
    return size;
  }
  if (isString(obj)) {
    size = new TextEncoder().encode(obj).length;
  } else if (isNumber(obj)) {
    size = 8;
  } else if (isBoolean(obj)) {
    size = 4;
  } else if (isArray(obj)) {
    size = obj.reduce((acc, item) => acc + estimateObjectSize(item), 0);
  } else if (isObject(obj)) {
    size = values(obj).reduce((acc: number, value: any) => acc + estimateObjectSize(value), 0) as number;
  }
  return size;
}

export function readableFileSize(size: number): string {
  return humanFileSize(size);
}
