import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgHeaderTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

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
        <div class="px-2 py-1">
          <app-badge-button inline [icon]="faCheck" caption="Select all" (click)="selectAll()" [disabled]="!available?.length" [height]="28"></app-badge-button>
        </div>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div>{{ item }}</div>
      </ng-template>
    </ng-select>
  `,
  styles: [`
    :host ::ng-deep .ng-dropdown-header .inline-button
      padding: 2px 8px
      font-size: 0.875rem
  `],
  imports: [FormsModule, NgSelectComponent, NgHeaderTemplateDirective, NgOptionTemplateDirective, BadgeButtonComponent]
})
export class CollectionsMultiSelectComponent {
  @Input() available: string[] = [];
  @Input() selected: string[] = [];
  @Input() placeholder?: string;
  @Output() selectedChange = new EventEmitter<string[]>();
  faCheck = faCheck;

  selectAll() {
    this.selected = [...(this.available || [])];
    this.selectedChange.emit(this.selected);
  }

}
