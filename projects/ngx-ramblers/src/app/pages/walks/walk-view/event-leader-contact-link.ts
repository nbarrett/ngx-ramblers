import { Component, inject, Input } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { WalkDisplayService } from "../walk-display.service";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
  selector: "app-event-leader-contact-link",
  template: `
    @if (display.walkLeaderContactHref(walk)) {
      <a [href]="display.walkLeaderContactHref(walk)"
         [target]="display.isRamblersWebsiteContact() ? '_blank' : '_self'"
         container="body" [tooltip]="display.walkLeaderContactTooltip(walk)">{{ displayName }}</a>
    } @else if (display.isContactUsContact()) {
      <a class="tooltip-link"
         (click)="display.contactWalkLeader(walk)"
         container="body" [tooltip]="display.walkLeaderContactTooltip(walk)">{{ displayName }}</a>
    } @else {
      <span>{{ displayName }}</span>
    }`,
  imports: [TooltipDirective]
})
export class EventLeaderContactLinkComponent {

  display = inject(WalkDisplayService);

  @Input() walk: ExtendedGroupEvent;
  @Input() fallbackLabel = "";

  get displayName(): string {
    return this.walk?.fields?.contactDetails?.displayName || this.fallbackLabel;
  }
}
