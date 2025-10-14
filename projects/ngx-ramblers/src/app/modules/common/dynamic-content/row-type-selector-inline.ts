import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PageContentType } from "../../../models/content-text.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";

@Component({
  selector: "app-row-type-selector-inline",
  template: `
    <select [class]="cssClass"
            [(ngModel)]="type"
            (ngModelChange)="onTypeChange()">
      @for (typeOption of enumKeyValuesForPageContentType; track typeOption) {
        <option [ngValue]="typeOption.value">{{ stringUtils.asTitle(typeOption.value) }}</option>
      }
    </select>
  `,
  imports: [FormsModule]
})
export class RowTypeSelectorInlineComponent {
  stringUtils = inject(StringUtilsService);
  enumKeyValuesForPageContentType: KeyValue<string>[] = enumKeyValues(PageContentType);

  @Input() type: PageContentType;
  @Input() cssClass = "form-select form-select-sm";
  @Output() typeChange = new EventEmitter<PageContentType>();

  onTypeChange() {
    this.typeChange.emit(this.type);
  }
}
