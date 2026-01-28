import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective } from "@ng-select/ng-select";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { LegendPosition } from "../../models/content-text.model";
import { enumKeyValues, KeyValue } from "../../functions/enums";

@Component({
  selector: "app-legend-position-selector",
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective],
  styles: [`
    .position-icon
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
    <ng-select [items]="legendPositions"
               bindValue="value"
               bindLabel="key"
               [searchable]="false"
               [clearable]="false"
               [disabled]="disabled"
               [(ngModel)]="value"
               (ngModelChange)="onValueChange($event)">
      <ng-template ng-label-tmp let-item="item">
        <span class="position-icon" [innerHTML]="positionIcon(item.value)"></span>
        {{ positionLabel(item.value) }}
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <span class="position-icon" [innerHTML]="positionIcon(item.value)"></span>
        {{ positionLabel(item.value) }}
      </ng-template>
    </ng-select>
  `
})
export class LegendPositionSelectorComponent {
  private sanitizer = inject(DomSanitizer);
  legendPositions: KeyValue<string>[] = enumKeyValues(LegendPosition);

  @Input() value: LegendPosition = LegendPosition.TOP_RIGHT;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<LegendPosition>();

  onValueChange(value: LegendPosition) {
    this.valueChange.emit(value);
  }

  positionLabel(position: LegendPosition): string {
    switch (position) {
      case LegendPosition.TOP_LEFT: return "Top left (on map)";
      case LegendPosition.TOP_RIGHT: return "Top right (on map)";
      case LegendPosition.BOTTOM_LEFT: return "Bottom left (on map)";
      case LegendPosition.BOTTOM_RIGHT: return "Bottom right (on map)";
      case LegendPosition.BELOW_MAP: return "Below map (full width)";
      default: return position;
    }
  }

  positionIcon(position: LegendPosition): SafeHtml {
    const boxStyle = "fill:none;stroke:#666;stroke-width:1";
    const dotStyle = "fill:#5B9BD5";
    const barStyle = "fill:#5B9BD5";
    let svg = "";

    switch (position) {
      case LegendPosition.TOP_LEFT:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect x="1" y="1" width="22" height="16" rx="2" style="${boxStyle}"/>
          <rect x="3" y="3" width="6" height="4" rx="1" style="${dotStyle}"/>
        </svg>`;
        break;
      case LegendPosition.TOP_RIGHT:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect x="1" y="1" width="22" height="16" rx="2" style="${boxStyle}"/>
          <rect x="15" y="3" width="6" height="4" rx="1" style="${dotStyle}"/>
        </svg>`;
        break;
      case LegendPosition.BOTTOM_LEFT:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect x="1" y="1" width="22" height="16" rx="2" style="${boxStyle}"/>
          <rect x="3" y="11" width="6" height="4" rx="1" style="${dotStyle}"/>
        </svg>`;
        break;
      case LegendPosition.BOTTOM_RIGHT:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect x="1" y="1" width="22" height="16" rx="2" style="${boxStyle}"/>
          <rect x="15" y="11" width="6" height="4" rx="1" style="${dotStyle}"/>
        </svg>`;
        break;
      case LegendPosition.BELOW_MAP:
        svg = `<svg width="24" height="18" viewBox="0 0 24 18">
          <rect x="1" y="1" width="22" height="11" rx="2" style="${boxStyle}"/>
          <rect x="1" y="14" width="22" height="3" rx="1" style="${barStyle}"/>
        </svg>`;
        break;
    }
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
