import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  NgHeaderTemplateDirective,
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent
} from "@ng-select/ng-select";
import { EnvironmentInfo } from "../../../models/backup-session.model";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { HasNgSelectAttributes } from "../../../models/ramblers-walks-manager";
import { SelectAllHeaderComponent } from "./select-all-header";

@Component({
  selector: "app-environment-select",
  template: `
    @if (label) {
      <label class="form-label">{{ labelText() }}</label>
    }
    <ng-select
      [items]="displayItems"
      [multiple]="multiple"
      [closeOnSelect]="!multiple"
      [searchable]="true"
      [clearable]="true"
      [appendTo]="'body'"
      [dropdownPosition]="'bottom'"
      [placeholder]="placeholder || (multiple ? 'Select environment(s)...' : 'Select environment...')"
      [bindLabel]="'ngSelectAttributes.label'"
      [bindValue]="multiple ? undefined : 'name'"
      [(ngModel)]="ngModelValue"
      (ngModelChange)="onModelChange()"
      name="environmentSelect"
      appearance="outline">
      @if (multiple && showSelectAllHeader) {
        <ng-template ng-header-tmp>
          <app-select-all-header [allSelected]="allSelected()" [disabled]="!items?.length" (toggle)="toggleSelectAll()"></app-select-all-header>
        </ng-template>
      }
      @if (!multiple) {
        <ng-template ng-label-tmp>
          {{ selectedName | humanise }}
        </ng-template>
      }
      <ng-template ng-option-tmp let-item="item">
        <div>
          <strong>{{ item.ngSelectAttributes.label }}</strong>
          <div><small>Database: {{ item.database }}</small></div>
        </div>
      </ng-template>
    </ng-select>
  `,
  imports: [FormsModule, NgSelectComponent, NgHeaderTemplateDirective, NgLabelTemplateDirective, NgOptionTemplateDirective, HumanisePipe, SelectAllHeaderComponent]
})
export class EnvironmentSelectComponent {
  private _items: EnvironmentInfo[] = [];
  @Input() set items(value: EnvironmentInfo[]) {
    this._items = value || [];
    this.displayItems = this._items.map(item => ({
      ...item,
      ngSelectAttributes: { label: this.humanise.transform(item.name) }
    }));
    this.syncNgModelFromInputs();
  }
  get items(): EnvironmentInfo[] { return this._items; }

  @Input() multiple = false;
  @Input() showSelectAllHeader = false;
  @Input() placeholder?: string;
  @Input() label?: string;

  @Input() selected: EnvironmentInfo[] = [];
  @Output() selectedChange = new EventEmitter<EnvironmentInfo[]>();

  @Input() selectedName: string;
  @Output() selectedNameChange = new EventEmitter<string>();

  private humanise = inject(HumanisePipe);
  displayItems: (EnvironmentInfo & HasNgSelectAttributes)[] = [];

  ngModelValue: any;

  private syncNgModelFromInputs() {
    if (this.multiple) {
      const names = new Set((this.selected || []).map(s => s.name));
      this.ngModelValue = this.displayItems.filter(i => names.has(i.name));
    } else {
      this.ngModelValue = this.selectedName || null;
    }
  }

  onModelChange() {
    if (this.multiple) {
      const originals = (this.ngModelValue || []).map((s: EnvironmentInfo) => this.items.find(i => i.name === s.name) || s);
      this.selectedChange.emit(originals);
    } else {
      this.selectedNameChange.emit(this.ngModelValue || "");
    }
  }

  selectAll() {
    this.ngModelValue = [...(this.displayItems || [])];
    this.onModelChange();
  }

  selectNone() {
    this.ngModelValue = this.multiple ? [] : null;
    this.onModelChange();
  }

  allSelected(): boolean {
    return this.multiple && (this.items?.length || 0) > 0 && (this.ngModelValue?.length || 0) === this.items.length;
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectNone();
    } else {
      this.selectAll();
    }
  }

  labelText(): string {
    if (!this.label) {
      return "";
    }
    if (!this.multiple) {
      return this.label;
    }
    const totalCount = this.items?.length || 0;
    const selectedCount = this.ngModelValue?.length || 0;
    return `${this.label} (${selectedCount} of ${totalCount} selected)`;
  }
}
