import { Pipe, PipeTransform } from "@angular/core";
import kebabCase from "lodash-es/kebabCase";

@Pipe({
  name: "kebabCase",
  standalone: false
})
export class KebabCasePipe implements PipeTransform {

  transform(value: string) {
    return kebabCase(value);
  }

}
