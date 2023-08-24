import { Pipe, PipeTransform } from "@angular/core";
import compact from "lodash-es/compact";

@Pipe({name: "asEventNote"})
export class EventNotePipe implements PipeTransform {

  transform(event: any) {
    return compact([event.description, event.reason]).join(", ");
  }

}
