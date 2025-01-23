import { Pipe, PipeTransform } from "@angular/core";
import kebabCase from "lodash-es/kebabCase";

@Pipe({ name: "kebabCase" })
export class KebabCasePipe implements PipeTransform {

  transform(value: string) {
    return kebabCase(value);
  }

}
