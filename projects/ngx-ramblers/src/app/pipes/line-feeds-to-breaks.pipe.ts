import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "lineFeedsToBreaks",
  standalone: false
})
export class LineFeedsToBreaksPipe implements PipeTransform {

  transform(value: string) {
    if (!value) {
      return value;
    }
    return value
      .replace(/(\r\n|\r|\n)/g, "<br/>");
  }

}
