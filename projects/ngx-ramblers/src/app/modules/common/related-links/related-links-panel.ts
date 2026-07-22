import { Component, Input } from "@angular/core";
import { RelatedLinksComponent } from "./related-links";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalksConfig } from "../../../models/walks-config.model";

@Component({
  selector: "app-related-links-panel",
  styles: [`
    :host
      display: flex
      flex-direction: column

    .event-panel
      flex: 1
  `],
  template: `
    <div class="event-panel rounded event-panel-inner">
      <h1>Related Links</h1>
      <div class="row">
        <app-related-links [displayedWalk]="displayedWalk" [walksConfigOverride]="walksConfigOverride"/>
      </div>
    </div>`,
  imports: [RelatedLinksComponent]
})
export class RelatedLinksPanelComponent {
  @Input() displayedWalk: DisplayedWalk;
  @Input() walksConfigOverride?: WalksConfig;
}
