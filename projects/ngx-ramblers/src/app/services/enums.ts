export function enumForKey<E>(enumValue: E, value: string): E[keyof E] {
  const resolvedEnum = Object.entries(enumValue)?.find((entry: any) => {
    return value?.toUpperCase() === entry[0]?.toUpperCase();
  });
  return resolvedEnum && resolvedEnum[1];
}

export function enumValues<E>(enumValue: E): any[] {
  return enumKeyValues(enumValue)?.map(item => item.value);
}

export function enumKeys<E>(enumValue: E): string[] {
  return enumKeyValues(enumValue)?.map(item => item.key);
}

function keyValue<E>(enumValue: E, value: any): KeyValue {
  return enumKeyValues(enumValue)?.find(item => item?.value?.toLowerCase() === value?.toString()?.toLowerCase());
}

export function enumKeyForValue<E>(enumValue: E, value: any): string {
  return keyValue(enumValue, value)?.key;
}

export function enumValueForKey<E>(enumValue: E, value: any): string {
  return keyValue(enumValue, value)?.value;
}

export function enumKeyValues<E>(enumValue: E): KeyValue[] {
  return Object.entries(enumValue)?.map((value) => ({key: value[0], value: value[1]})).filter(item => isNaN(+item.key));
}

export interface KeyValue {
  key: string;
  value: any;
}
