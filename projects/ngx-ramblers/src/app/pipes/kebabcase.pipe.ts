import { Pipe, PipeTransform } from "@angular/core";
import { kebabCase } from "es-toolkit/compat";

@Pipe({ name: "kebabCase" })
export class KebabCasePipe implements PipeTransform {

  transform(value: string) {
    return kebabCase(value);
  }

}
