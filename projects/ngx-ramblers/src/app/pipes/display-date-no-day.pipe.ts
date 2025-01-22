import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({
  name: "displayDateNoDay",
  standalone: false
})
export class DisplayDateNoDayPipe implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(dateValue: any) {
    return this.dateUtils.displayDateNoDay(dateValue);
  }

}
