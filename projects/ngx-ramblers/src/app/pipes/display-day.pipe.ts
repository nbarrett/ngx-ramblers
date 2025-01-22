import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({
  name: "displayDay",
  standalone: false
})
export class DisplayDayPipe implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(dateValue: any) {
    return this.dateUtils.displayDay(dateValue);
  }

}
