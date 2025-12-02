import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PageContentRow, PageContentType } from "../../../models/content-text.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";

@Component({
  selector: "app-row-type-selector",
  template: `
    <div class="col-auto">
      <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, contentPath + '-type')">
        Row Type
      </label>
      <select class="form-control input-sm"
              [(ngModel)]="row.type"
              (ngModelChange)="onTypeChange()"
              [id]="actions.rowColumnIdentifierFor(rowIndex, 0, contentPath + '-type')">
        @for (type of enumKeyValuesForPageContentType; track type) {
          <option [ngValue]="type.value">{{ displayValue(type.value) }}</option>
        }
      </select>
    </div>
  `,
  imports: [FormsModule]
})
export class RowTypeSelectorComponent {
  stringUtils = inject(StringUtilsService);
  actions = inject(PageContentActionsService);
  enumKeyValuesForPageContentType: KeyValue<string>[] = enumKeyValues(PageContentType);

  @Input() row: PageContentRow;
  @Input() rowIndex: number;
  @Input() contentPath: string;
  @Output() typeChange = new EventEmitter<PageContentType>();

  onTypeChange() {
    this.typeChange.emit(this.row.type);
  }

  displayValue(value: string): string {
    if (value === PageContentType.ALBUM_INDEX) {
      return "Index";
    }
    return this.stringUtils.asTitle(value);
  }
}
