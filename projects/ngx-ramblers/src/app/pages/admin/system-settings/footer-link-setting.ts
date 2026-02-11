import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { ExternalSystem } from "../../../models/system.model";

@Component({
  selector: "app-footer-link-setting",
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <div class="form-check">
      <input [(ngModel)]="externalSystem.showFooterLink"
             type="checkbox" class="form-check-input"
             [id]="name + '-show-footer-link'">
      <label class="form-check-label"
             [for]="name + '-show-footer-link'">
        @if (icon) {
          <fa-icon [icon]="icon" class="me-1"/>
        }
        Show {{ title }}
      </label>
    </div>
    <div class="form-group">
      <label [for]="name + '-group-url'">{{ title }} Url</label>
      <input [(ngModel)]="externalSystem.groupUrl"
             type="text" class="form-control input-sm"
             [id]="name + '-group-url'"
             [placeholder]="'Enter a group url for ' + title">
    </div>
    <ng-content/>`
})
export class FooterLinkSetting {
  @Input() externalSystem: ExternalSystem;
  @Input() name: string;
  @Input() title: string;
  @Input() icon: IconDefinition;
}
