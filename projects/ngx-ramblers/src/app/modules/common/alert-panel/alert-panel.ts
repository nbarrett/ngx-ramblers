import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { AlertPanelVariant } from "../../../models/alert-panel.model";

@Component({
  selector: "app-alert-panel",
  standalone: true,
  imports: [FontAwesomeModule],
  styleUrl: "./alert-panel.sass",
  template: `
    <div class="alert-panel alert-panel-{{ variant }}">
      <div class="alert-panel-title">
        <fa-icon [icon]="icon"/>
        <span>{{ title }}</span>
      </div>
      <div class="alert-panel-message">
        <ng-content/>
      </div>
      <div class="alert-panel-actions">
        <ng-content select="[alertActions]"/>
      </div>
    </div>`
})
export class AlertPanelComponent {
  @Input() title = "";
  @Input() icon: IconDefinition = faTriangleExclamation;
  @Input() variant: AlertPanelVariant = AlertPanelVariant.WARNING;
}
