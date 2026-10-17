import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CopyIconComponent } from "../../modules/common/copy-icon/copy-icon";
import { sortBy } from "../../functions/arrays";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGripVertical, faLocationDot, faTrash } from "@fortawesome/free-solid-svg-icons";
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from "@angular/cdk/drag-drop";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { LocatePointNameChange, LocateSavedPoint } from "../../models/locate.model";
import { DEFAULT_GRID_REFERENCE_DIGITS } from "../../models/walks-config.model";
import { formatGridReference } from "../../functions/grid-reference";

@Component({
  selector: "app-locate-points-list",
  imports: [CopyIconComponent, FormsModule, FontAwesomeModule, TooltipDirective, CdkDropList, CdkDrag, CdkDragHandle],
  styles: [`
    .point-name-input
      min-width: 0
      background-color: var(--bs-body-bg, white)
      box-shadow: inset 0 0 0 1px var(--bs-border-color, #dee2e6)
  `],
  template: `
    <div class="d-grid gap-3" cdkDropList (cdkDropListDropped)="dropped($event)">
      @for (point of orderedPoints; track point.id; let last = $last) {
        <div cdkDrag [class.border-bottom]="!last" [class.pb-3]="!last">
          <div class="d-flex align-items-center gap-2 mb-2">
            <button type="button" class="btn btn-quiet btn-icon" cdkDragHandle tooltip="Drag to reorder" aria-label="Drag to reorder"><fa-icon [icon]="faGrip"/></button>
            <div class="d-flex align-items-center gap-2 flex-grow-1">
              <span class="small text-muted">{{ point.number }}</span>
              <input size="8" class="form-control form-control-sm point-name-input" [attr.aria-label]="'Name for ' + point.name" [ngModel]="point.name" [ngModelOptions]="{updateOn: 'blur'}" maxlength="80" placeholder="Point name"
                     (ngModelChange)="rename.emit({id: point.id, name: $event})" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()"/>
            </div>
            <div class="d-flex gap-2" (click)="$event.stopPropagation()">
              <button type="button" class="btn btn-primary btn-icon" [tooltip]="'Select ' + point.name" [attr.aria-label]="'Select ' + point.name" (click)="select.emit(point)"><fa-icon [icon]="faSelect"/></button>
              <button type="button" class="btn btn-quiet btn-icon" [tooltip]="'Remove ' + point.name" [attr.aria-label]="'Remove ' + point.name" (click)="remove.emit(point.id)"><fa-icon [icon]="faRemove"/></button>
            </div>
          </div>
          <div class="small"><app-copy-icon [value]="formattedGrid(point)" [elementName]="point.name + ' grid reference'"/>{{ formattedGrid(point) }}</div>
        </div>
      } @empty {
        <p class="small text-muted mb-0">Add a point from the map to keep it here.</p>
      }
    </div>
  `
})
export class LocatePointsListComponent {
  @Input() points: LocateSavedPoint[] = [];
  @Input() gridDigits = DEFAULT_GRID_REFERENCE_DIGITS;
  @Input() gridSpaced = true;
  @Output() select = new EventEmitter<LocateSavedPoint>();
  @Output() remove = new EventEmitter<string>();
  @Output() rename = new EventEmitter<LocatePointNameChange>();
  @Output() reorder = new EventEmitter<LocateSavedPoint[]>();
  protected readonly faSelect = faLocationDot;
  protected readonly faRemove = faTrash;
  protected readonly faGrip = faGripVertical;

  formattedGrid(point: LocateSavedPoint): string {
    return formatGridReference(point.point.gridReference10, this.gridDigits, this.gridSpaced);
  }

  get orderedPoints(): LocateSavedPoint[] {
    return [...this.points].sort(sortBy("number"));
  }

  dropped(event: CdkDragDrop<LocateSavedPoint[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const next = [...this.orderedPoints];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      this.reorder.emit(next);
    }
  }
}
