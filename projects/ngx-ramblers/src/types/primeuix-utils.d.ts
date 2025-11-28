declare module "@primeuix/utils" {
  export function cn(...args: any[]): string | undefined;
  export function classNames(...args: any[]): string | undefined;

  export type Handler = (evt: unknown) => void;
  export interface EventBusOptions {
    on(type: string, handler: Handler): void;
    off(type: string, handler: Handler): void;
    emit(type: string, evt?: unknown): void;
    clear(): void;
  }
  export function EventBus(): EventBusOptions;

  export function mergeProps(...props: any[]): object | undefined;

  export function compare<T = unknown>(value1: T, value2: T, comparator: (val1: T, val2: T) => number, order?: number): number;
  export function contains<T = unknown>(value: T, list: T[]): boolean;
  export function deepEquals(obj1: unknown, obj2: unknown): boolean;
  export function deepMerge(...args: Record<string, unknown>[]): Record<string, unknown>;
  export function equals(obj1: any, obj2: any, field?: string): boolean;
  export function filter<T = any>(value: T[], fields: string[], filterValue: string): T[];
  export function findIndexInList<T = any>(value: T, list: T[]): number;
  export function findLast<T = any>(arr: T[], callback: (value: T, index: number, array: T[]) => boolean): T | undefined;
  export function findLastIndex<T = any>(arr: T[], callback: (value: T, index: number, array: T[]) => boolean): number;
  export function getKeyValue<T extends Record<string, unknown>>(obj: T | undefined, key?: string, params?: unknown): unknown;
  export function insertIntoOrderedArray<T>(item: T, index: number, arr: T[], sourceArr: any[]): void;
  export function isArray(value: any, empty?: boolean): boolean;
  export function isDate(value: unknown): value is Date;
  export function isEmpty(value: any): boolean;
  export function isFunction(value: unknown): value is (...args: unknown[]) => unknown;
  export function isLetter(char: string): boolean;
  export function isNotEmpty(value: any): boolean;
  export function isNumber(value: unknown): boolean;
  export function isObject(value: unknown, empty?: boolean): value is object;
  export function isPrintableCharacter(char?: string): boolean;
  export function isScalar(value: any): boolean;
  export function isString(value: unknown, empty?: boolean): value is string;
  export function localeComparator(): (val1: string, val2: string) => number;
  export function matchRegex(str: string, regex?: RegExp): boolean;
  export function mergeKeys(...args: Record<string, unknown>[]): Record<string, unknown>;
  export function minifyCSS(css?: string): string | undefined;
  export function nestedKeys(obj?: Record<string, any>, parentKey?: string): string[];
  export function omit(obj: unknown, ...keys: string[]): unknown;
  export function removeAccents(str: string): string;
  export function reorderArray<T>(value: T[], from: number, to: number): void;
  export function resolve<T, P extends unknown[], R>(obj: T | ((...params: P) => R), ...params: P): T | R;
  export function resolveFieldData(data: any, field: any): any;
  export function shallowEqualProps(propsA: Record<string, unknown>, propsB: Record<string, unknown>): boolean;
  export function shallowEquals(objA: unknown, objB: unknown): boolean;
  export function sort<T>(value1: T, value2: T, order: number | undefined, comparator: (val1: T, val2: T) => number, nullSortOrder?: number): number;
  export function stringify(value: unknown, indent?: number, currentIndent?: number): string;
  export function toCamelCase(str: string): string;
  export function toCapitalCase(str: string): string;
  export function toFlatCase(str: string): string;
  export function toKebabCase(str: string): string;
  export function toMs(value: string | number): number;
  export function toTokenKey(str: string): string;
  export function toValue(value: unknown): unknown;
}

declare module "@primeuix/utils/classnames" {
  export * from "@primeuix/utils";
}

declare module "@primeuix/utils/dom" {
  export * from "@primeuix/utils";
}

declare module "@primeuix/utils/eventbus" {
  export * from "@primeuix/utils";
}

declare module "@primeuix/utils/mergeprops" {
  export * from "@primeuix/utils";
}

declare module "@primeuix/utils/object" {
  export * from "@primeuix/utils";
}

declare module "@primeuix/utils/uuid" {
  export * from "@primeuix/utils";
}

declare module "@primeuix/utils/zindex" {
  export * from "@primeuix/utils";
}
