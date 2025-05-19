import { Pipe, PipeTransform } from "@angular/core";
import { ExtendedGroupEvent } from "../models/group-event.model";

@Pipe({ name: "eventTimes" })
export class EventTimesPipe implements PipeTransform {

  transform(socialEvent: ExtendedGroupEvent) {
    const eventTimes = socialEvent.groupEvent.start_date_time;
    return eventTimes + (socialEvent.groupEvent.end_date_time ? " - " + socialEvent.groupEvent.end_date_time : "");
  }

}
