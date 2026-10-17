import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { MongoClusterInfo } from "../../../models/environment-setup.model";

@Component({
  selector: "app-mongo-cluster-select",
  imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective],
  styles: [`
    :host
      display: block
      width: 100%
      min-width: 0

    :host ::ng-deep .ng-select
      width: 100%
      min-width: 0

    :host ::ng-deep .ng-select .ng-select-container
      min-width: 0

    :host ::ng-deep .ng-select .ng-select-container .ng-value-container
      min-width: 0
      flex: 1 1 0
      overflow: hidden

    :host ::ng-deep .ng-select .ng-select-container .ng-value-container .ng-value
      display: block
      min-width: 0
      max-width: 100%
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
  `],
  template: `
    <ng-select
      [id]="id"
      [items]="clusters"
      bindLabel="cluster"
      [ngModel]="selected"
      (ngModelChange)="selectedChange.emit($event)"
      [clearable]="clearable"
      [disabled]="disabled"
      [searchable]="true"
      [appendTo]="'body'"
      [dropdownPosition]="'bottom'"
      [placeholder]="placeholder"
      appearance="outline">
      <ng-template ng-label-tmp let-item="item">{{ item.cluster }} ({{ item.environments.join(", ") }})</ng-template>
      <ng-template ng-option-tmp let-item="item">
        <strong>{{ item.cluster }}</strong>
        <div><small>{{ item.environments.join(", ") }}</small></div>
      </ng-template>
    </ng-select>
  `
})
export class MongoClusterSelectComponent {
  @Input() id: string | null = null;
  @Input() clusters: MongoClusterInfo[] = [];
  @Input() selected: MongoClusterInfo | null = null;
  @Input() clearable = true;
  @Input() disabled = false;
  @Input() placeholder = "Select a MongoDB cluster";
  @Output() selectedChange = new EventEmitter<MongoClusterInfo | null>();
}
