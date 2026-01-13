import { Component, EventEmitter, Input, Output } from "@angular/core";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-visibility-toggle-button",
  imports: [FontAwesomeModule, TooltipDirective],
  template: `
    <span class="d-inline-flex align-items-center"
          [tooltip]="tooltipText()"
          (click)="onToggle()"
          [style.cursor]="disabled ? 'default' : 'pointer'"
          [style.opacity]="disabled ? 0.5 : 1">
      <fa-icon [icon]="expanded ? faEyeSlash : faEye" [style.color]="iconColor"></fa-icon>
    </span>
  `
})
export class VisibilityToggleButton {
  @Input() expanded = false;
  @Input() showTooltip = "View details";
  @Input() hideTooltip = "Hide details";
  @Input() iconColor = "var(--ramblers-colour-mintcake)";
  @Input() disabled = false;
  @Output() toggle = new EventEmitter<void>();

  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;

  tooltipText(): string {
    return this.expanded ? this.hideTooltip : this.showTooltip;
  }

  onToggle() {
    if (!this.disabled) {
      this.toggle.emit();
    }
  }
}
