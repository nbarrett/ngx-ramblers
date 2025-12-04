import { DateValue } from "../models/date.model";
import { isUndefined } from "es-toolkit/compat";

export function isDateValue(value: any): value is DateValue {
  return !isUndefined((value as DateValue)?.date) && !isUndefined((value as DateValue)?.value);
}

