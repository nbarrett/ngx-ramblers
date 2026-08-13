import { DateDirection, RelativeDateRange } from "./search.model";

export interface DateValue {
  value: number;
  date: Date;
}

export interface DateRangeSliderPreset {
  label: string;
  relativeDateRange: RelativeDateRange;
}

export const DATE_RANGE_SLIDER_PRESETS: DateRangeSliderPreset[] = [
  {label: "Next 7 days", relativeDateRange: {direction: DateDirection.FUTURE, duration: {days: 7}}},
  {label: "Next month", relativeDateRange: {direction: DateDirection.FUTURE, duration: {months: 1}}},
  {label: "Next 3 months", relativeDateRange: {direction: DateDirection.FUTURE, duration: {months: 3}}},
  {label: "Next 6 months", relativeDateRange: {direction: DateDirection.FUTURE, duration: {months: 6}}},
  {label: "Next year", relativeDateRange: {direction: DateDirection.FUTURE, duration: {years: 1}}},
  {label: "Last 7 days", relativeDateRange: {direction: DateDirection.PAST, duration: {days: 7}}},
  {label: "Last month", relativeDateRange: {direction: DateDirection.PAST, duration: {months: 1}}},
  {label: "Last 3 months", relativeDateRange: {direction: DateDirection.PAST, duration: {months: 3}}},
  {label: "Last year", relativeDateRange: {direction: DateDirection.PAST, duration: {years: 1}}}
];

export interface EventTimesProps {
  prefixes?: boolean,
  noDates?: boolean,
  noTimes?: boolean
}

