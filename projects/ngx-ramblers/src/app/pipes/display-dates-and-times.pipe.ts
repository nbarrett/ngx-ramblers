import { Pipe, PipeTransform } from "@angular/core";
import { DisplayDatePipe } from "./display-date.pipe";
import { DisplayDateAndTimePipe } from "./display-date-and-time.pipe";

@Pipe({name: "displayDatesAndTimes"})
export class DisplayDatesAndTimesPipe implements PipeTransform {
  constructor(private displayDateAndTimePipe: DisplayDateAndTimePipe  ) {
  }

  transform(dateValues: any[]) {
    return dateValues.map((dateValue) => this.displayDateAndTimePipe.transform(dateValue)).join(", ");
  }

}
