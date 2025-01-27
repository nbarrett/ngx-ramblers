import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayDate" })
export class DisplayDatePipe implements PipeTransform {
  private dateUtils = inject(DateUtilsService);


  transform(dateValue: any) {
    return this.dateUtils.displayDate(dateValue);
  }

}
