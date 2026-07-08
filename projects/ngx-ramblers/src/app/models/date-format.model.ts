export enum RamblersWalksManagerDateFormat {
  WALKS_MANAGER_CSV = "dd/MM/yyyy",
  WALKS_MANAGER_API = "yyyy-MM-dd",
  FILE_TIMESTAMP = "yyyy-MM-dd-HH-mm-ss",
  EXPORT_FILENAME = "dd-MMMM-yyyy-HH-mm",
  DISPLAY_DATE_FULL = "cccc, d MMMM yyyy"
}

export enum RamblersInsightHubDateFormat {
  FOUR_DIGIT_YEAR = "dd/MM/yyyy",
  TWO_DIGIT_YEAR = "dd/MM/yy",
}

export enum UIDateFormat {
  RAMBLERS_TIME = "HH:mm",
  DAY_MONTH_ABBREVIATED_TIME = "dd MMM HH:mm",
  DISPLAY_TIME = "h:mm a",
  DISPLAY_TIME_WITH_SECONDS = "h:mm:ss a",
  DISPLAY_DATE_AND_TIME = "cccc, d MMMM yyyy, h:mm:ss a",
  DISPLAY_DATE_TH = "MMMM d, yyyy",
  DISPLAY_DATE = "cccc, d MMMM yyyy",
  DISPLAY_DATE_NO_COMMA = "cccc d MMMM yyyy",
  DISPLAY_DATE_NO_DAY = "d MMMM yyyy",
  DAY_MONTH_ABBREVIATED_YEAR = "d MMM yyyy",
  DAY_MONTH_YEAR_WITH_SLASHES_COMPACT = "d/M/yyyy",
  DISPLAY_DAY = "cccc MMMM d, yyyy",
  DAY_NAME = "cccc",
  DAY_MONTH_YEAR_WITH_SLASHES = "dd/MM/yyyy",
  DAY_MONTH_YEAR_ABBREVIATED = "dd MMM yyyy",
  DAY_MONTH_YEAR_DASHED = "d-MMM-yyyy",
  MONTH_YEAR_ABBREVIATED = "MMM yyyy",
  YEAR_MONTH_DAY_T_HHMM = "yyyy-MM-dd'T'HHmm",
  YEAR_MONTH_DAY_WITH_DASHES = "yyyy-MM-dd",
  YEAR_MONTH_DAY_TIME_WITH_MINUTES = "yyyy-LL-dd HH:mm",
  YEAR_MONTH_DAY = "yyyyMMdd",
  DAY_MONTH_YEAR_ABBREVIATED_TIME = "dd MMM yyyy HH:mm",
  DAY_MONTH_YEAR_ABBREVIATED_TIME_ZONE = "dd MMM yyyy HH:mm ZZZZ",
  DAY_MONTH_YEAR_DASHED_ZERO_PADDED = "dd-MMM-yyyy",
  DISPLAY_DATE_AT_TIME = "cccc, d MMMM yyyy 'at' h:mm a",
  FILE_TIMESTAMP_COMPACT = "yyyyMMdd-HHmmss",
  YEAR = "yyyy",
  WEEKDAY_DAY_MONTH_YEAR_ABBREVIATED = "ccc, d MMM yyyy",
  WEEKDAY_DAY_MONTH_YEAR = "ccc, d MMMM yyyy",
  WEEKDAY_DAY_MONTH_YEAR_APOSTROPHE = "ccc, d MMMM ''yy",
  UTC_TIMESTAMP_WITH_MILLIS = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
}

export enum BsDatepickerFormat {
  DATE_INPUT = "dddd, D MMMM YYYY"
}

export const TYPED_DATE_INPUT_FORMATS: UIDateFormat[] = [
  UIDateFormat.DISPLAY_DATE,
  UIDateFormat.DISPLAY_DATE_NO_COMMA,
  UIDateFormat.WEEKDAY_DAY_MONTH_YEAR,
  UIDateFormat.WEEKDAY_DAY_MONTH_YEAR_ABBREVIATED,
  UIDateFormat.DISPLAY_DATE_NO_DAY,
  UIDateFormat.DAY_MONTH_ABBREVIATED_YEAR,
  UIDateFormat.DAY_MONTH_YEAR_DASHED,
  UIDateFormat.DAY_MONTH_YEAR_WITH_SLASHES_COMPACT,
  UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES
];
