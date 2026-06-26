import { toPairs } from "es-toolkit/compat";

export function enumForKey<E>(enumValue: E, value: string): E[keyof E] {
  const match = enumKeyValues(enumValue)?.find(item =>
    value?.toUpperCase() === item.key?.toUpperCase()
    || value?.toLowerCase() === `${item.value}`.toLowerCase());
  return match?.value as E[keyof E];
}

export function enumValues<E>(enumValue: E): any[] {
  return enumKeyValues(enumValue)?.map(item => item.value);
}

export function enumKeys<E>(enumValue: E): string[] {
  return enumKeyValues(enumValue)?.map(item => item.key);
}

function keyValue<E>(enumValue: E, value: any): KeyValue<string> {
  return enumKeyValues(enumValue)?.find(item => item?.value?.toLowerCase() === value?.toString()?.toLowerCase());
}

export function enumKeyForValue<E>(enumValue: E, value: any): string {
  return keyValue(enumValue, value)?.key;
}

export function enumValueForKey<E>(enumValue: E, value: any): string {
  return keyValue(enumValue, value)?.value;
}

export function enumKeyValues<E>(enumValue: E): KeyValue<string>[] {
  return toPairs(enumValue as object)?.map((value) => ({key: value[0], value: value[1]})).filter(item => isNaN(+item.key));
}

  export interface KeyValue<T> {
  key: string;
  value: T;
}

export interface TypedKeyValue<K,V> {
  key: K;
  value: V;
}

export const KEY_NULL_VALUE_NONE: KeyValue<string> = {value: "(none)", key: null};
export const KEY_NULL_VALUE_NA: KeyValue<string> = {value: "(not applicable)", key: null};
