import { isArray, isObject, isUndefined } from "es-toolkit/compat";
import { DeepPartial } from "../models/utility-types";

export function assignDeep<T>(target: T, source?: DeepPartial<T>): T {
  if (!source) {
    return target;
  }
  const targetRecord = target as Record<string, any>;
  const sourceRecord = source as Record<string, any>;
  Object.keys(sourceRecord).forEach(key => {
    const value = sourceRecord[key];
    if (isUndefined(value)) {
      return;
    }
    if (isObject(value) && !isArray(value)) {
      const currentTarget = isObject(targetRecord[key]) && !isArray(targetRecord[key]) ? targetRecord[key] : {};
      targetRecord[key] = assignDeep(currentTarget, value as DeepPartial<any>);
    } else {
      targetRecord[key] = value;
    }
  });
  return target;
}
