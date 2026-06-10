import { get } from "es-toolkit/compat";

export const range = (start: number, end: number) => {
  return Array.from({length: end - start + 1}, (v, k) => k + start);
};

export const descending = () => (a, b) => b - a;

export const ascending = () => (a, b) => a - b;

export const uniq = (values: any[]) => {
  return [...new Set(values)].sort();
};

export function move(array: any[], fromIndex: number, toIndex: number): any[] {
  array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
  return array;
}

export const sortBy = (...properties: string[]) => (nextItem, currentItem) => properties
  .map((property: string) => {
    const isDescending = property[0] === "-";
    const dir = isDescending ? -1 : 1;
    const path = (isDescending ? property.substring(1) : property).split(".");
    const nextValue = get(nextItem, path);
    const currentValue = get(currentItem, path);
    const nextMissing = nextValue === null || nextValue === undefined;
    const currentMissing = currentValue === null || currentValue === undefined;
    if (nextMissing && currentMissing) {
      return 0;
    } else if (nextMissing) {
      return 1;
    } else if (currentMissing) {
      return -1;
    } else {
      return nextValue > currentValue ? dir : nextValue < currentValue ? -(dir) : 0;
    }
  })
  .reduce((previous, next) => previous ? previous : next, 0);

export function firstPopulated<T>(...values: T[][]): T[] {
  return values?.find(item => item?.length > 0) || [];
}

export function reversed<T>(items: T[]): T[] {
  return [...(items || [])].reverse();
}

