import { DateValue } from "../models/date.model";

export function isDateValue(value: any): value is DateValue {
  return (value as DateValue)?.date !== undefined && (value as DateValue)?.value !== undefined;
}


