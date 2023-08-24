import { Pipe, PipeTransform } from "@angular/core";
import { StringUtilsService } from "../services/string-utils.service";

@Pipe({name: "valueOrDefault"})
export class ValueOrDefaultPipe implements PipeTransform {
  constructor(private stringUtils: StringUtilsService) {
  }

  transform(value?: any, defaultValue?: any, bothNullValue?: any) {
    return this.stringUtils.stringifyObject(value) ?? defaultValue ?? bothNullValue ?? "(none)";
  }

}
