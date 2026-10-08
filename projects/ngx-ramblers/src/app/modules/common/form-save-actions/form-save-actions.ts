import { Component, Input, output, signal } from "@angular/core";
import { NgClass } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRightFromBracket, faSave, faSpinner, faTimes, faUndo } from "@fortawesome/free-solid-svg-icons";
import { FormSaveActions, FormSaveExitAction } from "../../../models/form-save-actions.model";
import { ButtonDropdownComponent } from "../button-dropdown/button-dropdown";
import { ButtonDropdownItem } from "../../../models/button-dropdown.model";

enum FormSaveBusyAction {
  SAVE = "save",
  SAVE_AND_EXIT = "saveAndExit",
  UNDO = "undo"
}

@Component({
  selector: "app-form-save-actions",
  imports: [NgClass, TooltipDirective, FontAwesomeModule, ButtonDropdownComponent],
  template: `
    <div class="form-save-actions d-flex flex-wrap align-items-center gap-2">
      <button type="button"
              class="btn d-inline-flex align-items-center gap-2"
              [ngClass]="controlsDisabled() ? 'btn-secondary' : 'btn-success'"
              [disabled]="controlsDisabled()"
              (click)="runSave()">
        @if (busyAction() === FormSaveBusyAction.SAVE) {
          <fa-icon [icon]="faSpinner" animation="spin"/>
        } @else {
          <fa-icon [icon]="faSave"/>
        }
        {{ saveLabel }}
      </button>
      <button type="button"
              class="btn d-inline-flex align-items-center gap-2"
              [ngClass]="controlsDisabled() ? 'btn-secondary' : 'btn-quiet'"
              [disabled]="controlsDisabled()"
              (click)="runUndo()">
        @if (busyAction() === FormSaveBusyAction.UNDO) {
          <fa-icon [icon]="faSpinner" animation="spin"/>
        } @else {
          <fa-icon [icon]="faUndo"/>
        }
        {{ undoLabel }}
      </button>
      <app-button-dropdown [label]="exitMenuLabel"
                           [icon]="busyAction() === FormSaveBusyAction.SAVE_AND_EXIT ? faSpinner : faRightFromBracket"
                           [iconSpin]="busyAction() === FormSaveBusyAction.SAVE_AND_EXIT"
                           [buttonClass]="controlsDisabled() ? 'btn btn-secondary' : 'btn btn-quiet'"
                           [disabled]="controlsDisabled()"
                           [tooltip]="saveAndExitLabel"
                           [defaultItemId]="FormSaveExitAction.SAVE_AND_EXIT"
                           insideClick
                           [items]="exitMenuItems()"
                           (itemSelect)="onExitMenu($event)"/>
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

  busyAction = signal<FormSaveBusyAction | null>(null);
  protected readonly faRightFromBracket = faRightFromBracket;
  protected readonly faSave = faSave;
  protected readonly faSpinner = faSpinner;
  protected readonly faTimes = faTimes;
  protected readonly faUndo = faUndo;
  protected readonly FormSaveBusyAction = FormSaveBusyAction;
  protected readonly FormSaveExitAction = FormSaveExitAction;

  controlsDisabled(): boolean {
    return this.disabled || this.busyAction() !== null;
  }

  protected exitMenuItems(): ButtonDropdownItem[] {
    return [
      {id: FormSaveExitAction.SAVE_AND_EXIT, label: this.saveAndExitLabel, icon: this.faRightFromBracket, disabled: this.controlsDisabled()},
      {id: FormSaveExitAction.CANCEL, label: this.cancelLabel, icon: this.faTimes, disabled: this.controlsDisabled()}
    ];
  }

  protected onExitMenu(action: string): void {
    if (action === FormSaveExitAction.SAVE_AND_EXIT) {
      this.runSaveAndExit();
    } else if (action === FormSaveExitAction.CANCEL) {
      this.runCancel();
    }
  }

  runSave(): void {
    void this.runBusyAction(FormSaveBusyAction.SAVE, () => this.actions ? this.actions.save() : this.save.emit());
  }

  runSaveAndExit(): void {
    void this.runBusyAction(FormSaveBusyAction.SAVE_AND_EXIT, () => this.actions ? this.actions.saveAndExit() : this.saveAndExit.emit());
  }

  runUndo(): void {
    void this.runBusyAction(FormSaveBusyAction.UNDO, () => this.actions ? this.actions.undo() : this.undo.emit());
  }

  runCancel(): void {
    if (this.controlsDisabled()) {
      return;
    } else if (this.actions) {
      void this.actions.cancel();
    } else {
      this.cancel.emit();
    }
  }

  private async runBusyAction(action: FormSaveBusyAction, work: () => unknown | Promise<unknown>): Promise<void> {
    if (!this.controlsDisabled()) {
      this.busyAction.set(action);
      try {
        await Promise.resolve(work());
      } catch {
      } finally {
        this.busyAction.set(null);
      }
    }
  }
}
