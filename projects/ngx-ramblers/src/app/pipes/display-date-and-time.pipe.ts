import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayDateAndTime" })
export class DisplayDateAndTimePipe implements PipeTransform {
  private dateUtils = inject(DateUtilsService);


  transform(dateValue: any): string {
    return this.dateUtils.displayDateAndTime(dateValue);
  }

}
