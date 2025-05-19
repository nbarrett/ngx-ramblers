import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayDate" })
export class DisplayDatePipe implements PipeTransform {
  private dateUtils: DateUtilsService = inject(DateUtilsService);

  transform(dateValue: any): string {
    return this.dateUtils.displayDate(dateValue);
  }

}
