import { Component, inject, Input } from "@angular/core";
import { StringUtilsService } from "../../services/string-utils.service";
import { IconService } from "../../services/icon-service/icon-service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-status-icon",
    template: `
    <div class="form-inline">
      <fa-icon [icon]="icons.toFontAwesomeIcon(status).icon"
        [class]="icons.toFontAwesomeIcon(status).class"/>
      @if (!noLabel) {
        <div class="ml-2">{{ stringUtils.asTitle(status) }}</div>
      }
    </div>`,
    styleUrls: ["./member-bulk-load/member-bulk-load.component.sass", "./admin/admin.component.sass"],
    imports: [FontAwesomeModule]
})
export class StatusIconComponent {

  protected icons = inject(IconService);
  protected stringUtils = inject(StringUtilsService);
  protected noLabel: boolean;

  @Input() status: string;

  @Input("noLabel") set noLabelValue(value: boolean) {
    this.noLabel = coerceBooleanProperty(value);
  }

}
