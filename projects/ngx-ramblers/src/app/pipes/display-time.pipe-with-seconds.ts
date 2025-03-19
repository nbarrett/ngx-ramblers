import { inject, Pipe, PipeTransform } from "@angular/core";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({ name: "displayTimeWithSeconds" })
export class DisplayTimeWithSecondsPipe implements PipeTransform {
  private dateUtils = inject(DateUtilsService);


  transform(dateValue: any): string {
    return this.dateUtils.displayTimeWithSeconds(dateValue);
  }

}
