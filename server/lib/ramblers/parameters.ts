import {
  DateFormat,
  EventsListRequest,
  GroupListRequest,
  MAXIMUM_PAGE_SIZE,
  WALKS_MANAGER_GO_LIVE_DATE
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import moment from "moment-timezone";
import { momentNow } from "../shared/dates";

export function dateParameter(body: EventsListRequest, debugLog: debug.Debugger): string {
  if (body?.ids?.length > 0) {
    const dateParameter = moment(WALKS_MANAGER_GO_LIVE_DATE).tz("Europe/London").startOf("day").format(DateFormat.WALKS_MANAGER_API);
    debugLog("returning dateParameter:", dateParameter, "given id request:", body.ids, "and dateEnd:", body.date);
    return dateParameter;
  } else {
    debugLog("returning dateParameter:", body.date, "given id request:", body.ids);
    return body.date;
  }
}

export function dateEndParameter(body: EventsListRequest, debugLog: debug.Debugger): string {
  if (body?.ids?.length > 0) {
    const dateEndParameter = momentNow().add(12, "month").format(DateFormat.WALKS_MANAGER_API);
    debugLog("returning dateEndParameter:", dateEndParameter, "given id request:", body.ids, "and dateEnd:", body.dateEnd);
    return dateEndParameter;
  } else {
    debugLog("returning dateEndParameter:", body.dateEnd, "given id request:", body.ids);
    return body.dateEnd;
  }
}

export function limitFor(body: GroupListRequest) {
  return body.limit || MAXIMUM_PAGE_SIZE;
}
