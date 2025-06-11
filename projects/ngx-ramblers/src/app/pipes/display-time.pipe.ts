import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayTime" })
export class DisplayTimePipe implements PipeTransform {
  private dateUtils = inject(DateUtilsService);

  transform(dateValue: any): string {
    if (!dateValue || this.dateUtils.isMidnight(dateValue)) {
      return "";
    } else {
      return this.dateUtils.displayTime(dateValue);
    }
  }

}
