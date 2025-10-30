import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgHeaderTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { BackupListItem } from "../../../models/backup-session.model";
import { DatePipe } from "@angular/common";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-backups-multi-select",
  template: `
    <ng-select
      [items]="items"
      [multiple]="true"
      [closeOnSelect]="false"
      [searchable]="true"
      [clearable]="true"
      [appendTo]="'body'"
      [dropdownPosition]="'bottom'"
      bindLabel="name"
      [placeholder]="placeholder || 'Select multiple backups...'"
      [(ngModel)]="selected"
      (ngModelChange)="selectedChange.emit(selected)"
      name="backupsMultiSelect"
      appearance="outline">
      <ng-template ng-header-tmp>
        <div class="px-2 py-1">
          <app-badge-button inline [icon]="faCheck" caption="Select all" (click)="selectAll()" [disabled]="!items?.length"></app-badge-button>
        </div>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div>
          <strong>{{ item.name }}</strong>
          <div><small>{{ item.timestamp ? (item.timestamp | date:'medium') : '' }}</small></div>
        </div>
      </ng-template>
    </ng-select>
  `,
  imports: [FormsModule, NgSelectComponent, NgHeaderTemplateDirective, NgOptionTemplateDirective, DatePipe, BadgeButtonComponent]
})
export class BackupsMultiSelectComponent {
  @Input() items: BackupListItem[] = [];
  @Input() selected: BackupListItem[] = [];
  @Input() placeholder?: string;
  @Output() selectedChange = new EventEmitter<BackupListItem[]>();
  faCheck = faCheck;

  selectAll() {
    this.selected = [...(this.items || [])];
    this.selectedChange.emit(this.selected);
  }

}
