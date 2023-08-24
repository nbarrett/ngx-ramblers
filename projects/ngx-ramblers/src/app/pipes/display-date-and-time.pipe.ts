import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({name: "displayDateAndTime"})
export class DisplayDateAndTimePipe implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(dateValue: any): string {
    return this.dateUtils.displayDateAndTime(dateValue);
  }

}
