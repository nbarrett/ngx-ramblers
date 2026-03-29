import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgHeaderTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { SelectAllHeaderComponent } from "./select-all-header";

@Component({
  selector: "app-collections-multi-select",
  template: `
    <ng-select
      [items]="available"
      [multiple]="true"
      [closeOnSelect]="false"
      [searchable]="true"
      [clearable]="true"
      [appendTo]="'body'"
      [dropdownPosition]="'bottom'"
      [placeholder]="placeholder || 'Select collections...'"
      [(ngModel)]="selected"
      (ngModelChange)="selectedChange.emit(selected)"
      name="collectionsMultiSelect"
      appearance="outline">
      <ng-template ng-header-tmp>
        <app-select-all-header [allSelected]="selected?.length === available?.length" [disabled]="!available?.length" (toggle)="toggleSelectAll()"></app-select-all-header>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div>{{ item }}</div>
      </ng-template>
    </ng-select>
  `,
  imports: [FormsModule, NgSelectComponent, NgHeaderTemplateDirective, NgOptionTemplateDirective, SelectAllHeaderComponent]
})
export class CollectionsMultiSelectComponent {
  @Input() available: string[] = [];
  @Input() selected: string[] = [];
  @Input() placeholder?: string;
  @Output() selectedChange = new EventEmitter<string[]>();

  toggleSelectAll() {
    this.selected = this.selected?.length === this.available?.length ? [] : [...(this.available || [])];
    this.selectedChange.emit(this.selected);
  }
}
