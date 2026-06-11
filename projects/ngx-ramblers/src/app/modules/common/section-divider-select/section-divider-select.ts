import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectModule } from "@ng-select/ng-select";
import { SECTION_DIVIDER_OPTIONS, SectionDividerStyle } from "../../../models/email-composer.model";

@Component({
  selector: "app-section-divider-select",
  imports: [FormsModule, NgSelectModule],
  styles: [`
    .section-divider-select
      display: flex
      align-items: center
      gap: 12px
      margin: 6px 0

    .section-divider-select label
      flex: 0 0 auto
      margin: 0
      white-space: nowrap

    .section-divider-select ng-select
      flex: 1 1 auto
      min-width: 240px

    .section-divider-row
      display: flex
      align-items: center
      gap: 12px
      width: 100%

    .section-divider-row-label
      flex: 0 0 auto
      min-width: 120px

    .section-divider-row-preview
      flex: 1 1 auto
      align-self: center
      border-top: 1px solid transparent

    :host ::ng-deep ng-select .ng-value
      display: block
      width: 100%

    :host ::ng-deep ng-select .ng-value-label
      display: block
      width: 100%

    @media (max-width: 575.98px)
      .section-divider-select ng-select
        min-width: 0
  `],
  template: `
    <div class="section-divider-select">
      <label>{{ label }}</label>
      <ng-select [items]="options"
                 bindValue="key"
                 bindLabel="label"
                 [clearable]="false"
                 [searchable]="false"
                 [ngModel]="value"
                 (ngModelChange)="valueChange.emit($event)">
        <ng-template ng-label-tmp let-item="item">
          <div class="section-divider-row">
            <span class="section-divider-row-label">{{ item.label }}</span>
            <span class="section-divider-row-preview"
                  [style.borderTop]="item.cssBorder === 'none' ? '1px dashed transparent' : item.cssBorder"></span>
          </div>
        </ng-template>
        <ng-template ng-option-tmp let-item="item">
          <div class="section-divider-row">
            <span class="section-divider-row-label">{{ item.label }}</span>
            <span class="section-divider-row-preview"
                  [style.borderTop]="item.cssBorder === 'none' ? '1px dashed transparent' : item.cssBorder"></span>
          </div>
        </ng-template>
      </ng-select>
    </div>
  `
})
export class SectionDividerSelectComponent {
  @Input() label = "Divider after this section";
  @Input() value: SectionDividerStyle = SectionDividerStyle.THIN_YELLOW;
  @Output() valueChange = new EventEmitter<SectionDividerStyle>();
  protected readonly options = SECTION_DIVIDER_OPTIONS;
}
