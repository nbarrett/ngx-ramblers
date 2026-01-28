import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective } from "@ng-select/ng-select";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { SharedDistrictStyle } from "../../models/system.model";
import { enumKeyValues, KeyValue } from "../../functions/enums";

@Component({
  selector: "app-shared-district-style-selector",
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective],
  styles: [`
    .style-icon
      display: inline-flex
      align-items: center
      vertical-align: middle
      margin-right: 8px

    :host ::ng-deep .ng-value
      display: flex
      align-items: center

    :host ::ng-deep .ng-option
      display: flex
      align-items: center
  `],
  template: `
    <ng-select [items]="sharedDistrictStyles"
               bindValue="value"
               bindLabel="key"
               [searchable]="false"
               [clearable]="false"
               [(ngModel)]="value"
               (ngModelChange)="onValueChange($event)">
      <ng-template ng-label-tmp let-item="item">
        <span class="style-icon" [innerHTML]="styleIcon(item.value)"></span>
        {{ styleLabel(item.value) }}
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <span class="style-icon" [innerHTML]="styleIcon(item.value)"></span>
        {{ styleLabel(item.value) }}
      </ng-template>
    </ng-select>
  `
})
export class SharedDistrictStyleSelectorComponent {
  private sanitizer = inject(DomSanitizer);
  sharedDistrictStyles: KeyValue<string>[] = enumKeyValues(SharedDistrictStyle);

  @Input() value: SharedDistrictStyle = SharedDistrictStyle.FIRST_GROUP;
  @Output() valueChange = new EventEmitter<SharedDistrictStyle>();

  onValueChange(value: SharedDistrictStyle) {
    this.valueChange.emit(value);
  }

  styleLabel(style: SharedDistrictStyle): string {
    switch (style) {
      case SharedDistrictStyle.STRIPES: return "Diagonal stripes with all group colors";
      case SharedDistrictStyle.FIRST_GROUP: return "Solid color of first assigned group";
      case SharedDistrictStyle.DASHED_BORDER: return "Dashed border to indicate sharing";
      case SharedDistrictStyle.GRADIENT: return "Gradient blend of group colors";
      default: return style;
    }
  }

  styleIcon(style: SharedDistrictStyle): SafeHtml {
    let svg = "";
    switch (style) {
      case SharedDistrictStyle.STRIPES:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <defs>
            <pattern id="icon-stripes-${this.uniqueId}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="3" height="6" fill="#5B9BD5"/>
              <rect x="3" width="3" height="6" fill="#ED7D31"/>
            </pattern>
          </defs>
          <rect width="24" height="18" rx="2" fill="url(#icon-stripes-${this.uniqueId})"/>
        </svg>`;
        break;
      case SharedDistrictStyle.FIRST_GROUP:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect width="24" height="18" rx="2" fill="#5B9BD5"/>
        </svg>`;
        break;
      case SharedDistrictStyle.DASHED_BORDER:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect x="1" y="1" width="22" height="16" rx="2" fill="#5B9BD5" stroke="#333" stroke-width="1.5" stroke-dasharray="4,2"/>
        </svg>`;
        break;
      case SharedDistrictStyle.GRADIENT:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <defs>
            <linearGradient id="icon-gradient-${this.uniqueId}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#5B9BD5"/>
              <stop offset="100%" stop-color="#ED7D31"/>
            </linearGradient>
          </defs>
          <rect width="24" height="18" rx="2" fill="url(#icon-gradient-${this.uniqueId})"/>
        </svg>`;
        break;
    }
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private uniqueId = Math.random().toString(36).substring(2, 9);
}
