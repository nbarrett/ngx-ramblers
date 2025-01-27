import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayDateNoDay" })
export class DisplayDateNoDayPipe implements PipeTransform {
  private dateUtils = inject(DateUtilsService);


  transform(dateValue: any) {
    return this.dateUtils.displayDateNoDay(dateValue);
  }

}
