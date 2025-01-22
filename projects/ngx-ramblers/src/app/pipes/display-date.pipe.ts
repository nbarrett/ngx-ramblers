import { Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({
  name: "displayDate",
  standalone: false
})
export class DisplayDatePipe implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(dateValue: any) {
    return this.dateUtils.displayDate(dateValue);
  }

}
