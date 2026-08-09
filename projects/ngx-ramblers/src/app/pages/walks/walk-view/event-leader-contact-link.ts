import { Component, inject, Input } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { EventContactService } from "../../../services/walks-and-events/event-contact.service";
import { JointLeaderNamesPipe } from "../../../pipes/joint-leader-names.pipe";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-event-leader-contact-link",
  template: `
    @if (label) {
      @if (contactActionAvailable && eventContact.eventLeaderContactHref(walk)) {
        <a [href]="eventContact.eventLeaderContactHref(walk)"
           [target]="eventContact.isRamblersWebsiteContact(walk) ? '_blank' : '_self'"
           container="body" [tooltip]="eventContact.eventLeaderContactTooltip(walk)">
          @for (name of label | jointLeaderNames; track $index) {
            <span class="d-block">{{ name }}</span>
          }
        </a>
      } @else if (contactActionAvailable && eventContact.isContactUsContact(walk)) {
        <a class="tooltip-link"
           (click)="eventContact.contactEventLeader(walk)"
           container="body" [tooltip]="eventContact.eventLeaderContactTooltip(walk)">
          @for (name of label | jointLeaderNames; track $index) {
            <span class="d-block">{{ name }}</span>
          }
        </a>
      } @else {
        <span>
          @for (name of label | jointLeaderNames; track $index) {
            <span class="d-block">{{ name }}</span>
          }
        </span>
      }
    }`,
  imports: [TooltipDirective, JointLeaderNamesPipe]
})
export class EventLeaderContactLinkComponent {

  eventContact = inject(EventContactService);
  display = inject(WalkDisplayService);

  @Input() walk: ExtendedGroupEvent;
  @Input() fallbackLabel = "";

  get contactActionAvailable(): boolean {
    return this.display.hasContactLink(this.walk);
  }

  get label(): string {
    if (this.display.contactNameVisible(this.walk)) {
      return this.walk?.fields?.contactDetails?.displayName || this.fallbackLabel || this.eventContact.contactLinkFallbackLabel(this.walk);
    } else if (this.display.contactLinkVisible(this.walk)) {
      return this.fallbackLabel || this.eventContact.contactLinkFallbackLabel(this.walk);
    } else {
      return "";
    }
  }
}
