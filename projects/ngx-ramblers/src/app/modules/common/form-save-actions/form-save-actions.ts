import { Component, Input, output } from "@angular/core";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { NgClass } from "@angular/common";
import { FormSaveActions } from "../../../models/form-save-actions.model";

@Component({
  selector: "app-form-save-actions",
  imports: [BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, NgClass],
  template: `
    <div class="form-save-actions d-flex flex-wrap align-items-center gap-2">
      <button type="button"
              class="btn"
              [ngClass]="disabled ? 'btn-secondary' : 'btn-success'"
              [disabled]="disabled"
              (click)="runSave()">
        {{ saveLabel }}
      </button>
      <button type="button"
              class="btn"
              [ngClass]="disabled ? 'btn-secondary' : 'btn-quiet'"
              [disabled]="disabled"
              (click)="runUndo()">
        {{ undoLabel }}
      </button>
      <div class="btn-group" dropdown [insideClick]="true">
        <button type="button"
                class="btn dropdown-toggle"
                [ngClass]="disabled ? 'btn-secondary' : 'btn-quiet'"
                [disabled]="disabled"
                dropdownToggle
                aria-haspopup="true"
                aria-controls="form-save-actions-exit-menu">
          {{ exitMenuLabel }}
        </button>
        <ul *dropdownMenu class="dropdown-menu" id="form-save-actions-exit-menu" role="menu">
          <li role="menuitem">
            <button type="button" class="dropdown-item" [disabled]="disabled" (click)="runSaveAndExit()">
              {{ saveAndExitLabel }}
            </button>
          </li>
          <li role="menuitem">
            <button type="button" class="dropdown-item" [disabled]="disabled" (click)="runCancel()">
              {{ cancelLabel }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .form-save-actions .dropdown-item
      cursor: pointer

    .form-save-actions .dropdown-item:disabled
      cursor: not-allowed
      opacity: 0.65
  `]
})
export class FormSaveActionsComponent {
  @Input() disabled = false;
  @Input() actions: FormSaveActions | null = null;
  @Input() saveLabel = "Save";
  @Input() saveAndExitLabel = "Save and exit";
  @Input() undoLabel = "Undo changes";
  @Input() cancelLabel = "Exit without saving";
  @Input() exitMenuLabel = "Exit";

  save = output<void>();
  saveAndExit = output<void>();
  undo = output<void>();
  cancel = output<void>();

  runSave(): void {
    if (this.actions) {
      void this.actions.save();
    } else {
      this.save.emit();
    }
  }

  runSaveAndExit(): void {
    if (this.actions) {
      void this.actions.saveAndExit();
    } else {
      this.saveAndExit.emit();
    }
  }

  runUndo(): void {
    if (this.actions) {
      void this.actions.undo();
    } else {
      this.undo.emit();
    }
  }

  runCancel(): void {
    if (this.actions) {
      void this.actions.cancel();
    } else {
      this.cancel.emit();
    }
  }
}
