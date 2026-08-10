import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { VolunteerParish, VolunteerParishEligibility, VolunteerParishType } from "../../../models/volunteer-management.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-volunteer-parish-editor",
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <section class="parish-editor" aria-labelledby="parish-editor-heading">
      <div class="parish-editor-heading">
        <div>
          <h2 id="parish-editor-heading">Edit parish</h2>
          <p class="mb-0">Official code, groupings and whether the parish counts towards vacancies.</p>
        </div>
      </div>
      <div class="parish-form">
        <label>Parish name
          <input class="form-control" type="text" [(ngModel)]="parishName" [disabled]="saving" required>
        </label>
        <label>Official parish code
          <input class="form-control" type="text" [ngModel]="parishCode" [disabled]="true" readonly>
        </label>
        <label>Counts towards vacancies
          <select class="form-select" [(ngModel)]="eligibility" [disabled]="saving">
            <option [ngValue]="VolunteerParishEligibility.ACTIVE">Yes, this parish needs cover</option>
            <option [ngValue]="VolunteerParishEligibility.NO_PUBLIC_RIGHTS_OF_WAY">No, it has no public rights of way</option>
          </select>
        </label>
        <label>Authority name
          <input class="form-control" type="text" [(ngModel)]="localAuthorityName" [disabled]="saving">
        </label>
        <label>Authority code
          <input class="form-control" type="text" [(ngModel)]="localAuthorityCode" [disabled]="saving">
        </label>
        <label>Sector
          <input class="form-control" type="text" [(ngModel)]="sectorCode" [disabled]="saving">
        </label>
        <label>Parish type
          <select class="form-select" [(ngModel)]="parishType" [disabled]="saving">
            <option [ngValue]="null">Not set</option>
            <option [ngValue]="VolunteerParishType.PARISH">Parish</option>
            <option [ngValue]="VolunteerParishType.NON_PARISHED_AREA">Non-parished area</option>
            <option [ngValue]="VolunteerParishType.WARD">Ward</option>
          </select>
        </label>
        <label>Rights-of-way group
          <input class="form-control" type="text" [(ngModel)]="rightsOfWayGroupCode" [disabled]="saving">
        </label>
        <label>Membership group
          <input class="form-control" type="text" [(ngModel)]="membershipGroupCode" [disabled]="saving">
        </label>
        <label class="notes-field">Notes
          <textarea class="form-control" rows="3" [(ngModel)]="notes" [disabled]="saving"></textarea>
        </label>
      </div>
      <div class="parish-actions">
        <button type="button" class="btn btn-primary" (click)="emitSave()" [disabled]="saving || !parishName">{{ saving ? "Saving…" : "Save parish" }}</button>
        <button type="button" class="btn btn-quiet" (click)="close.emit()" [disabled]="saving"><fa-icon [icon]="faXmark" class="me-1"/>Cancel</button>
      </div>
    </section>
  `,
  styles: [`
    .parish-editor
      display: grid
      gap: var(--space-4)
      padding: var(--space-5)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--ramblers-colour-sunrise)
      border-radius: var(--rsm-panel-radius)
      background: var(--rsm-panel-bg)
    .parish-editor-heading
      display: flex
      align-items: start
      justify-content: space-between
      gap: var(--space-3)
    .parish-editor-heading h2
      margin: 0
      font-size: 1.25rem
    .parish-form
      display: grid
      grid-template-columns: repeat(3, minmax(0, 1fr))
      gap: var(--space-3)
    .parish-form label
      display: grid
      gap: var(--space-2)
      font-weight: 600
    .notes-field
      grid-column: 1 / -1
    .parish-actions
      display: flex
      gap: var(--space-2)
      position: sticky
      bottom: 0
      padding-top: var(--space-3)
      background: var(--rsm-panel-bg)
    @media (max-width: 767.98px)
      .parish-form
        grid-template-columns: 1fr
      .parish-editor-heading
        align-items: stretch
        flex-direction: column
      .parish-actions
        flex-direction: column
      .parish-actions .btn, .parish-editor-heading .btn
        width: 100%
  `]
})
export class VolunteerParishEditor {
  private logger: Logger = inject(LoggerFactory).createLogger("VolunteerParishEditor", NgxLoggerLevel.ERROR);
  protected readonly faXmark = faXmark;
  protected readonly VolunteerParishEligibility = VolunteerParishEligibility;
  protected readonly VolunteerParishType = VolunteerParishType;

  @Input() saving = false;
  @Input() set parish(parish: VolunteerParish | null) {
    this.editing = parish;
    this.parishName = parish?.parishName ?? "";
    this.parishCode = parish?.parishCode ?? "";
    this.eligibility = parish?.eligibility ?? VolunteerParishEligibility.ACTIVE;
    this.localAuthorityName = parish?.localAuthorityName ?? "";
    this.localAuthorityCode = parish?.localAuthorityCode ?? "";
    this.sectorCode = parish?.sectorCode ?? "";
    this.parishType = parish?.parishType ?? null;
    this.rightsOfWayGroupCode = parish?.rightsOfWayGroupCode ?? "";
    this.membershipGroupCode = parish?.membershipGroupCode ?? "";
    this.notes = parish?.notes ?? "";
    this.logger.debug("editing parish:", parish?.parishCode);
  }

  @Output() save = new EventEmitter<VolunteerParish>();
  @Output() close = new EventEmitter<void>();

  protected editing: VolunteerParish | null = null;
  protected parishName = "";
  protected parishCode = "";
  protected eligibility = VolunteerParishEligibility.ACTIVE;
  protected localAuthorityName = "";
  protected localAuthorityCode = "";
  protected sectorCode = "";
  protected parishType: VolunteerParishType | null = null;
  protected rightsOfWayGroupCode = "";
  protected membershipGroupCode = "";
  protected notes = "";

  protected emitSave(): void {
    if (this.editing) {
      this.save.emit({
        ...this.editing,
        parishName: this.parishName.trim(),
        eligibility: this.eligibility,
        localAuthorityName: this.localAuthorityName.trim(),
        localAuthorityCode: this.localAuthorityCode.trim(),
        sectorCode: this.sectorCode.trim(),
        parishType: this.parishType ?? undefined,
        rightsOfWayGroupCode: this.rightsOfWayGroupCode.trim(),
        membershipGroupCode: this.membershipGroupCode.trim(),
        notes: this.notes.trim()
      });
    } else {
      this.logger.error("emitSave called with no parish");
    }
  }
}
