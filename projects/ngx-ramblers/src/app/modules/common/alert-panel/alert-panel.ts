import { Component, Input } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { AlertPanelVariant } from "../../../models/alert-panel.model";

@Component({
  selector: "app-alert-panel",
  imports: [FontAwesomeModule],
  styleUrl: "./alert-panel.sass",
  template: `
    <div class="alert-panel alert-panel-{{ variant }}"
         [class.d-flex]="actionsEnd"
         [class.align-items-center]="actionsEnd"
         [class.justify-content-between]="actionsEnd"
         [class.flex-wrap]="actionsEnd"
         [class.gap-3]="actionsEnd">
      <div>
        <div class="alert-panel-title" [class.mb-0]="actionsEnd">
          <fa-icon [icon]="icon"/>
          <span>{{ title }}</span>
        </div>
        <div class="alert-panel-message">
          <ng-content/>
        </div>
      </div>
      <div class="alert-panel-actions" [class.mt-0]="actionsEnd">
        <ng-content select="[alertActions]"/>
      </div>
    </div>`
})
export class AlertPanelComponent {
  @Input() title = "";
  @Input() icon: IconDefinition = faTriangleExclamation;
  @Input() variant: AlertPanelVariant = AlertPanelVariant.WARNING;
  actionsEnd = false;

  @Input({alias: "actionsEnd"}) set actionsEndValue(value: boolean) {
    this.actionsEnd = coerceBooleanProperty(value);
  }
}
