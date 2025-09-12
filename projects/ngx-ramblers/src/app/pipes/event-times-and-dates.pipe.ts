import { inject, Pipe, PipeTransform } from "@angular/core";
import { ExtendedGroupEvent, HasStartAndEndTime } from "../models/group-event.model";
import { EM_DASH_WITH_SPACES } from "../models/content-text.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayTimePipe } from "./display-time.pipe";
import { DateUtilsService } from "../services/date-utils.service";
import { EventTimesProps } from "../models/date.model";

@Pipe({name: "eventDatesAndTimes"})
export class EventDatesAndTimesPipe implements PipeTransform {

  logger: Logger = inject(LoggerFactory).createLogger("EventDatesAndTimesPipe", NgxLoggerLevel.ERROR);
  private dateUtilsService = inject(DateUtilsService);
  private displayTimePipe = inject(DisplayTimePipe);

  transform(extendedGroupEvent: HasStartAndEndTime, config?: EventTimesProps): string {
    const start = extendedGroupEvent?.start_date_time;
    const end = extendedGroupEvent?.end_date_time;

    if (!start && !end) {
      return "";
    } else {
      const startDateTime = this.dateUtilsService.asDateTime(start);
      const endDateTime = this.dateUtilsService.asDateTime(end);
      const startPrefix = config?.prefixes ? `Start time: ` : " ";
      const finishPrefix = config?.prefixes ? `Finish Time: ` : " ";
      const startDate = config?.noDates ? "" : startDateTime.toFormat(this.dateUtilsService.formats.displayDate);
      this.logger.info("start:", start, "end:", end, "startDateTime:", startDateTime, "endDateTime:", endDateTime, "startDate:", startDate);
      if (startDateTime.hasSame(endDateTime, "day") || !end) {
        const startTime = config?.noTimes ? "" : this.displayTimePipe.transform(start);
        const endTime = config?.noTimes ? "" : this.displayTimePipe.transform(end);
        return `${startDate} ${startPrefix}${startTime}${!endTime ? "" : EM_DASH_WITH_SPACES}${finishPrefix}${endTime}`.trim();
      } else {
        const endDate = config?.noDates ? "" : endDateTime.toFormat(this.dateUtilsService.formats.displayDate);
        const startTime = config?.noTimes ? "" : this.displayTimePipe.transform(start);
        const endTime = config?.noTimes ? "" : this.displayTimePipe.transform(end);
        return `${startDate}${startPrefix}${startTime}${EM_DASH_WITH_SPACES}${endDate}${finishPrefix}${endTime}`.trim();
      }
    }
  }
}
