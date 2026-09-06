import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { WalkGpxFieldProposal } from "../../models/walk.model";

@Component({
  selector: "app-gpx-proposals",
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  template: `
    @if (loading) {
      <small class="text-muted d-block mt-2"><span class="spinner-border spinner-border-sm me-2"></span>Reading the route and looking up its start and finish…</small>
    } @else if (proposals.length > 0) {
      <div class="alert alert-warning d-flex align-items-start mt-2">
        <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1"/>
        <div class="ms-2 flex-grow-1 min-w-0">
          <strong class="d-block">Details found in the route</strong>
          <span class="d-block mb-2">Tick the details you want to take from the GPX file. Those that would replace something already entered are unticked.</span>
          @for (proposal of proposals; track proposal.field) {
            <div class="form-check">
              <input class="form-check-input" type="checkbox" [id]="id + '-gpx-proposal-' + proposal.field" [(ngModel)]="proposal.apply">
              <label class="form-check-label" [for]="id + '-gpx-proposal-' + proposal.field">
                <strong>{{ proposal.label }}:</strong> {{ proposal.proposedValue }}
                @if (proposal.currentValue) {
                  <span class="text-muted">(currently {{ proposal.currentValue }})</span>
                }
              </label>
            </div>
          }
          <div class="d-flex gap-2 mt-2">
            <button type="button" class="btn btn-primary btn-sm" (click)="applied.emit()">
              <fa-icon class="me-2" [icon]="faWandMagicSparkles"/>Apply ticked details
            </button>
            <button type="button" class="btn btn-quiet btn-sm" (click)="dismissed.emit()">Not now</button>
          </div>
        </div>
      </div>
    } @else if (message) {
      <small class="text-muted d-block mt-2">{{ message }}</small>
    }
  `
})
export class GpxProposalsComponent {
  @Input() id = "gpx";
  @Input() proposals: WalkGpxFieldProposal[] = [];
  @Input() loading = false;
  @Input() message: string | null = null;
  @Output() applied = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
}
