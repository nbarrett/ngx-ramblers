import moment from "moment-timezone";

export function momentNowAsValue(): number {
  return momentNow().valueOf();
}

export function momentNow(): moment {
  return moment().tz("Europe/London");
}

export function momentInTimezone(time: string, format?: string) {
  return moment(time, format).tz("Europe/London");
}
