import { inject, Pipe, PipeTransform } from "@angular/core";
import { WalksReferenceService } from "../services/walks/walks-reference-data.service";

@Pipe({ name: "walkEventType" })
export class WalkEventTypePipe implements PipeTransform {

  private walksReferenceService = inject(WalksReferenceService);


  transform(eventTypeString: string, field: string) {
    const eventType = eventTypeString && this.walksReferenceService.toWalkEventType(eventTypeString);
    return eventType && field ? eventType[field] : eventType;
  }

}
