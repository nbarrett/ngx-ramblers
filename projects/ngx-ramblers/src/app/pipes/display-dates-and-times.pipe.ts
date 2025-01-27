import { inject, Pipe, PipeTransform } from "@angular/core";
import { DisplayDateAndTimePipe } from "./display-date-and-time.pipe";

@Pipe({ name: "displayDatesAndTimes" })
export class DisplayDatesAndTimesPipe implements PipeTransform {
  private displayDateAndTimePipe = inject(DisplayDateAndTimePipe);


  transform(dateValues: any[]) {
    return dateValues.map((dateValue) => this.displayDateAndTimePipe.transform(dateValue)).join(", ");
  }

}
