import { Pipe, PipeTransform } from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { WalksReferenceService } from "../services/walks/walks-reference-data.service";

@Pipe({name: "toVenueIcon"})
export class VenueIconPipe implements PipeTransform {
  constructor(private walksReferenceService: WalksReferenceService) {
  }

  transform(value: string): IconDefinition {
    const venueType = this.walksReferenceService.venueTypes().find(item => item.type === value) || this.walksReferenceService.venueTypes()[0];
    return venueType.icon;
  }

}
