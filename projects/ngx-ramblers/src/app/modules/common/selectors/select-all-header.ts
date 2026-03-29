import { Component, EventEmitter, Input, Output } from "@angular/core";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-select-all-header",
  template: `
    <div class="px-2 py-1">
      <app-badge-button inline [icon]="faCheck" [caption]="allSelected ? 'Select none' : 'Select all'" (click)="toggle.emit()" [disabled]="disabled" [height]="28"/>
    </div>
  `,
  styles: [`
    :host ::ng-deep .inline-button
      padding: 2px 8px
      font-size: 0.875rem
  `],
  imports: [BadgeButtonComponent]
})
export class SelectAllHeaderComponent {
  @Input() allSelected = false;
  @Input() disabled = false;
  @Output() toggle = new EventEmitter<void>();
  faCheck = faCheck;
}
