import { Pipe, PipeTransform } from "@angular/core";
import { DisplayDatePipe } from "./display-date.pipe";

@Pipe({ name: "displayDates" })
export class DisplayDatesPipe implements PipeTransform {
  constructor(private displayDatePipe: DisplayDatePipe) {
  }

  transform(dateValues: any[]) {
    return dateValues.map((dateValue) => this.displayDatePipe.transform(dateValue)).join(", ");
  }

}
