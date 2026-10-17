import { Component, EventEmitter, Input, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSliders } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DELAYED_TOOLTIP_PROVIDERS } from "../../modules/common/tooltip-config";

@Component({
  selector: "app-advanced-toggle",
  imports: [FontAwesomeModule, TooltipDirective],
  providers: [...DELAYED_TOOLTIP_PROVIDERS],
  styles: [`
    :host
      display: inline-flex
    :host.w-100
      display: flex
      width: 100%
    :host.h-100
      height: 100%
    :host.h-100 button
      height: 100%
      width: 100%
    .advanced-toggle-icon
      display: inline-flex
      align-items: center
      justify-content: center
      transition: transform 0.3s ease-in-out
    .advanced-toggle-icon.rotated
      transform: rotate(90deg)
  `],
  template: `
    <button type="button"
            [class]="buttonClass"
            (click)="toggled.emit()"
            [attr.aria-expanded]="expanded"
            [attr.aria-controls]="ariaControls"
            [attr.aria-label]="accessibleName"
            [tooltip]="iconOnly ? accessibleName : null">
      <span class="advanced-toggle-icon" [class.me-2]="!iconOnly" [class.rotated]="expanded">
        <fa-icon [icon]="faSliders"/>
      </span>
      @if (!iconOnly) {
        {{ label }}
      }
    </button>
  `
})
export class AdvancedToggle {
  @Input() expanded = false;
  @Input() label = "Advanced";
  @Input() buttonClass = "btn btn-quiet";
  @Input() ariaControls = "";
  @Output() toggled = new EventEmitter<void>();
  protected readonly faSliders = faSliders;
  private iconOnlyValue = false;

  @Input()
  set iconOnly(value: boolean | string) {
    this.iconOnlyValue = coerceBooleanProperty(value);
  }

  get iconOnly(): boolean {
    return this.iconOnlyValue;
  }

  get accessibleName(): string {
    return this.label;
  }
}
