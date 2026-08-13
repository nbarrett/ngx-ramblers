import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { SelectablePreset } from "../../../models/search.model";

@Component({
  selector: "app-preset-select",
  standalone: true,
  imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective],
  template: `
    <ng-select
      [items]="items"
      [ngModel]="selected"
      (ngModelChange)="selectedChange.emit($event)"
      bindLabel="label"
      groupBy="groupLabel"
      [clearable]="clearable"
      [searchable]="searchable"
      [placeholder]="placeholder"
      [dropdownPosition]="dropdownPosition"
      (change)="change.emit($event)"
      class="rounded w-100">
      <ng-template ng-label-tmp let-item="item">
        <span [title]="(item.groupLabel ? item.groupLabel + ' - ' : '') + item.label">{{ item.label }}</span>
      </ng-template>
    </ng-select>`
})
export class PresetSelect<T extends SelectablePreset = SelectablePreset> {

  @Input() items: T[] = [];
  @Input() selected: T = null;
  @Input() placeholder: string = null;
  @Input() clearable = false;
  @Input() searchable = false;
  @Input() dropdownPosition = "bottom";
  @Output() selectedChange = new EventEmitter<T>();
  @Output() change = new EventEmitter<T>();
}
