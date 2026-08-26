import { booleanAttribute, Component, Input } from "@angular/core";
import { PageComponent } from "../../../page/page.component";
import { WalkProgrammeViewSelector } from "./walk-programme-view-selector";

@Component({
  selector: "app-walk-programme-page",
  imports: [PageComponent, WalkProgrammeViewSelector],
  template: `
    <app-page [autoTitle]="autoTitle" [showTitle]="showTitle">
      <ng-content select="[pageStart]"/>
      @if (showSelector) {
        <div class="programme-chrome" [class.sticky-toolbar]="sticky">
          <app-walk-programme-view-selector>
            <ng-content select="[programmeChrome]"/>
          </app-walk-programme-view-selector>
          <ng-content select="[programmeSticky]"/>
        </div>
      }
      <ng-content/>
    </app-page>
  `,
  styles: [`
    :host
      display: block
    .programme-chrome.sticky-toolbar
      padding-top: 0
      top: var(--space-2)
    @media (max-width: 768px)
      .programme-chrome.sticky-toolbar
        position: static
  `]
})
export class WalkProgrammePageComponent {
  @Input({transform: booleanAttribute}) autoTitle = true;
  @Input({transform: booleanAttribute}) showTitle = true;
  @Input({transform: booleanAttribute}) showSelector = true;
  @Input({transform: booleanAttribute}) sticky = false;
}
