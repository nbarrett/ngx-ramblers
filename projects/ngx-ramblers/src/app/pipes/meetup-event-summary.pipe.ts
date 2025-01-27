import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "meetupEventSummary" })
export class MeetupEventSummaryPipe implements PipeTransform {

  private dateUtils = inject(DateUtilsService);

  transform(meetupEvent: any) {
    return meetupEvent ? this.dateUtils.displayDate(meetupEvent.startTime) + " (" + meetupEvent.title + ")" : null;
  }

}
