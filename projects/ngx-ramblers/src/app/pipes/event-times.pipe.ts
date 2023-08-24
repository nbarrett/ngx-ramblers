import { Pipe, PipeTransform } from "@angular/core";
import { SocialEvent } from "../models/social-events.model";

@Pipe({name: "eventTimes"})
export class EventTimesPipe implements PipeTransform {

  transform(socialEvent: SocialEvent) {
    const eventTimes = socialEvent.eventTimeStart;
    return eventTimes + (socialEvent.eventTimeEnd ? " - " + socialEvent.eventTimeEnd : "");
  }

}
