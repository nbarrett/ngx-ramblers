import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({
  name: "meetupEventSummary",
  standalone: false
})
export class MeetupEventSummaryPipe implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(meetupEvent: any) {
    return meetupEvent ? this.dateUtils.displayDate(meetupEvent.startTime) + " (" + meetupEvent.title + ")" : null;
  }

}
