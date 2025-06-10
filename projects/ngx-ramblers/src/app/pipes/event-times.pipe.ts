import { inject, Pipe, PipeTransform } from "@angular/core";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { DisplayDatePipe } from "./display-date.pipe";
import { EM_DASH_WITH_SPACES } from "../models/content-text.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayTimePipe } from "./display-time.pipe";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "eventTimes" })
export class EventTimesPipe implements PipeTransform {

  logger: Logger = inject(LoggerFactory).createLogger("EventTimesPipe", NgxLoggerLevel.INFO);
  private dateUtilsService = inject(DateUtilsService);
  private displayDate = inject(DisplayDatePipe);
  private displayTimePipe = inject(DisplayTimePipe);

  transform(extendedGroupEvent: ExtendedGroupEvent) {
    const returnValue = [extendedGroupEvent?.groupEvent?.start_date_time, extendedGroupEvent?.groupEvent?.end_date_time]
      .filter(timestamp => timestamp && !this.dateUtilsService.isMidnight(timestamp))
      .map(timestamp => this.prefix(extendedGroupEvent, timestamp) + this.displayTimePipe.transform(timestamp))
      .join(EM_DASH_WITH_SPACES);
    this.logger.info("transform:start_date_time:", extendedGroupEvent?.groupEvent?.start_date_time, "end_date_time:", extendedGroupEvent?.groupEvent?.end_date_time, "returnValue:", returnValue);
    // return this.displayDate.transform(extendedGroupEvent?.groupEvent?.start_date_time || extendedGroupEvent?.groupEvent?.end_date_time) + EM_DASH_WITH_SPACES + returnValue;
    return returnValue;
  }

  private prefix(extendedGroupEvent: ExtendedGroupEvent, timestamp: string) {
    const isStartTime = extendedGroupEvent?.groupEvent?.start_date_time === timestamp;
    this.logger.info("prefix:timestamp:", timestamp, "extendedGroupEvent?.groupEvent?.start_date_time:", extendedGroupEvent?.groupEvent?.start_date_time, "isStartTime:", isStartTime);
    return isStartTime ? "Start time: " : "Finish Time: ";
  }
}
