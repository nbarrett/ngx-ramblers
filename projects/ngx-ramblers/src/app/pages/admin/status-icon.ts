import { Component, inject, Input, OnChanges, SimpleChanges } from "@angular/core";
import { StringUtilsService } from "../../services/string-utils.service";
import { IconService } from "../../services/icon-service/icon-service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
  selector: "app-status-icon",
  template: `
    <div class="d-inline-flex align-items-center flex-wrap">
      <fa-icon [icon]="icon.icon" [class]="icon.class"/>
      @if (!noLabel) {
        <div class="ms-2">{{ stringUtils.asTitle(status) }}</div>
      }
    </div>`,
  styleUrls: ["./member-bulk-load/member-bulk-load.component.sass", "./admin/admin.component.sass"],
  imports: [FontAwesomeModule]
})
export class StatusIconComponent implements OnChanges {
  protected icons = inject(IconService);
  protected stringUtils = inject(StringUtilsService);
  protected noLabel: boolean;
  protected icon: { icon: any; class: string };

  @Input() status: string;

  @Input("noLabel") set noLabelValue(value: boolean) {
    this.noLabel = coerceBooleanProperty(value);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["status"]) {
      this.updateIcon();
    }
  }

  private updateIcon(): void {
    this.icon = this.icons.toFontAwesomeIcon(this.status);
  }
}
