import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({name: "displayTime"})
export class DisplayTimePipe implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(dateValue: any): string {
    return this.dateUtils.displayTime(dateValue);
  }

}
