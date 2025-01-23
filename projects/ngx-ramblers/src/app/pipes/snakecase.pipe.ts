import { Pipe, PipeTransform } from "@angular/core";
import snakeCase from "lodash-es/snakeCase";

@Pipe({ name: "snakeCase" })
export class SnakeCasePipe implements PipeTransform {

  transform(value: string) {
    return snakeCase(value);
  }

}
