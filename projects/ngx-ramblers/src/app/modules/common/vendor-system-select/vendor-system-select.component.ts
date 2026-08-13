import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGrip } from "@fortawesome/free-solid-svg-icons";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { VendorSystemSelectItem } from "../../../models/vendor-brand.model";
import { VendorBrandMarkComponent } from "../vendor-brand-mark/vendor-brand-mark.component";

@Component({
  selector: "app-vendor-system-select",
  imports: [
    FormsModule,
    FontAwesomeModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    VendorBrandMarkComponent
  ],
  template: `
    @if (label) {
      <label class="form-label" [attr.for]="id">{{ label }}</label>
    }
    <ng-select [id]="id"
               class="vendor-system-select"
               [items]="items"
               bindLabel="label"
               bindValue="value"
               [clearable]="clearable"
               [searchable]="searchable"
               [appendTo]="'body'"
               [dropdownPosition]="'bottom'"
               [disabled]="disabled"
               [ngModel]="selectedValue"
               (ngModelChange)="onValueChange($event)"
               [name]="name"
               appearance="outline">
      <ng-template ng-label-tmp let-item="item">
        <div class="vendor-system-option">
          @if (item?.value === allValue) {
            <fa-icon [icon]="faGrip" class="vendor-system-option-fallback"></fa-icon>
          } @else {
            <app-vendor-brand-mark [brandKey]="brandKeyFor(item)"
                                   [inline]="true"/>
          }
          <span>{{ item?.label }}</span>
        </div>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div class="vendor-system-option">
          @if (item.value === allValue) {
            <fa-icon [icon]="faGrip" class="vendor-system-option-fallback"></fa-icon>
          } @else {
            <app-vendor-brand-mark [brandKey]="brandKeyFor(item)"
                                   [inline]="true"/>
          }
          <span>{{ item.label }}</span>
        </div>
      </ng-template>
    </ng-select>
  `,
  styles: [`
    :host
      display: block
      width: 100%

    .vendor-system-select
      width: 100%
      display: block

    .vendor-system-option
      display: flex
      align-items: center
      gap: 0.5rem
      min-width: 0
      line-height: 1.2
      pointer-events: none

    .vendor-system-option-fallback
      width: 1.15rem
      text-align: center
      font-size: 1rem
      flex: 0 0 auto
  `]
})
export class VendorSystemSelectComponent {
  @Input() id = "vendor-system-select";
  @Input() name = "vendorSystemSelect";
  @Input() label: string | null = null;
  @Input() items: VendorSystemSelectItem[] = [];
  @Input() allValue = "all";
  @Input() disabled = false;
  @Input() clearable = false;
  @Input() searchable = true;
  @Output() valueChange = new EventEmitter<string>();

  protected readonly faGrip = faGrip;
  selectedValue = "all";

  @Input()
  set value(next: string) {
    const resolved = next || this.allValue;
    if (resolved !== this.selectedValue) {
      this.selectedValue = resolved;
    }
  }

  get value(): string {
    return this.selectedValue;
  }

  brandKeyFor(item: VendorSystemSelectItem | null | undefined): string {
    if (!item) {
      return "";
    } else {
      return item.brandKey || item.systemId || item.value;
    }
  }

  onValueChange(next: string): void {
    const resolved = next || this.allValue;
    if (resolved !== this.selectedValue) {
      this.selectedValue = resolved;
      this.valueChange.emit(this.selectedValue);
    } else {
      this.valueChange.emit(this.selectedValue);
    }
  }
}
