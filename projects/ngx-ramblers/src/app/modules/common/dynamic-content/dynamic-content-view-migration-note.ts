import { Component, inject, Input } from "@angular/core";
import { DEFAULT_MIGRATION_NOTE_LABEL, PageContentRow } from "../../../models/content-text.model";
import { DateUtilsService } from "../../../services/date-utils.service";

@Component({
  selector: "app-dynamic-content-view-migration-note",
  template: `
    @if (row?.migrationNote) {
      <p class="migration-note">
        {{ row.migrationNote.label || defaultLabel }}
        @if (row.migrationNote.sourceUrl) {
          <a [href]="row.migrationNote.sourceUrl" target="_blank" rel="noopener noreferrer">{{ row.migrationNote.sourceUrl }}</a>
        }
        @if (row.migrationNote.migratedAt) {
          on {{ dateUtils.displayDateAndTime(row.migrationNote.migratedAt) }}
        }
      </p>
    }
  `
})
export class DynamicContentViewMigrationNote {
  protected dateUtils = inject(DateUtilsService);
  protected readonly defaultLabel = DEFAULT_MIGRATION_NOTE_LABEL;
  @Input() row: PageContentRow;
}
