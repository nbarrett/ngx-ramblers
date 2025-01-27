import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayDay" })
export class DisplayDayPipe implements PipeTransform {
  private dateUtils = inject(DateUtilsService);


  transform(dateValue: any) {
    return this.dateUtils.displayDay(dateValue);
  }

}
