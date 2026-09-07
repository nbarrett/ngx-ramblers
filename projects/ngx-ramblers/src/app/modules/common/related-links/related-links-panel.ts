import { Component, Input } from "@angular/core";
import { RelatedLinksComponent } from "./related-links";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalksConfig } from "../../../models/walks-config.model";

@Component({
  selector: "app-related-links-panel",
  styles: [`
    :host
      display: block
      margin-bottom: 0

    :host(.walk-meta-related)
      display: flex
      flex-direction: column
      height: 100%
      min-height: 0

    :host(.walk-meta-related) .event-panel
      display: flex
      flex-direction: column
      flex: 1 1 auto
      height: 100%
      min-height: 100%

    .event-panel-inner
      margin-bottom: 0

    :host(.walk-meta-related) .event-panel-inner
      flex: 1 1 auto
  `],
  template: `
    <div class="event-panel rounded event-panel-inner" [class.d-none]="!hasAnyLink">
      <h1>Related Links</h1>
      <div class="row">
        <app-related-links [displayedWalk]="displayedWalk"
                           [walksConfigOverride]="walksConfigOverride"
                           (hasAnyLinkChange)="hasAnyLink = $event"/>
      </div>
    </div>`,
  imports: [RelatedLinksComponent]
})
export class RelatedLinksPanelComponent {
  @Input() displayedWalk: DisplayedWalk;
  @Input() walksConfigOverride?: WalksConfig;
  protected hasAnyLink = true;
}
