import { inject, Pipe, PipeTransform } from "@angular/core";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { EM_DASH_WITH_SPACES } from "../models/content-text.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayTimePipe } from "./display-time.pipe";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({name: "eventDatesAndTimes"})
export class EventDatesAndTimesPipe implements PipeTransform {

  logger: Logger = inject(LoggerFactory).createLogger("EventTimesPipe", NgxLoggerLevel.INFO);
  private dateUtilsService = inject(DateUtilsService);
  private displayTimePipe = inject(DisplayTimePipe);

  transform(extendedGroupEvent: ExtendedGroupEvent, includePrefixes?: boolean) {
    const start = extendedGroupEvent?.groupEvent?.start_date_time;
    const end = extendedGroupEvent?.groupEvent?.end_date_time;

    if (!start && !end) {
      return "";
    }

    const startMoment = this.dateUtilsService.asMoment(start);
    const endMoment = this.dateUtilsService.asMoment(end);
    const startPrefix = includePrefixes ? `Start time: ` : " ";
    const finishPrefix = includePrefixes ? `Finish Time: ` : " ";

    if (startMoment.isSame(endMoment, "day") || !end) {
      const dateStr = startMoment.format("dddd MMMM D, YYYY");
      const startTime = this.displayTimePipe.transform(start);
      const endTime = this.displayTimePipe.transform(end);
      return `${dateStr} ${startPrefix}${startTime}${!endTime ? "" : EM_DASH_WITH_SPACES}${finishPrefix}${endTime}`;
    } else {
      const startDateStr = startMoment.format("dddd MMMM D, YYYY");
      const endDateStr = endMoment.format("dddd MMMM D, YYYY");
      const startTime = this.displayTimePipe.transform(start);
      const endTime = this.displayTimePipe.transform(end);
      return `${startDateStr}${startPrefix}${startTime}${EM_DASH_WITH_SPACES}${endDateStr}${finishPrefix}${endTime}`;
    }
  }
}
