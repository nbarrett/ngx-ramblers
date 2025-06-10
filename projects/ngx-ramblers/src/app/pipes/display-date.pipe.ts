import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayDate" })
export class DisplayDatePipe implements PipeTransform {
  private dateUtils: DateUtilsService = inject(DateUtilsService);

  constructor() {
    console.log("DisplayDatePipe: DateUtilsService injected:", this.dateUtils);
  }

  transform(dateValue: any): string {
    console.log("DisplayDatePipe: transform dateValue:", dateValue, "this:", this.dateUtils);
    return this.dateUtils.displayDate(dateValue);
  }

}
