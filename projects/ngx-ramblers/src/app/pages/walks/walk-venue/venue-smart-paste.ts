import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronRight, faMagic, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VenueParserService } from "../../../services/venue/venue-parser.service";
import { Venue, VenueParseResult } from "../../../models/event-venue.model";
import { isEmpty } from "es-toolkit/compat";

@Component({
  selector: "app-venue-smart-paste",
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <div class="smart-paste-container">
      <div class="smart-paste-header" (click)="toggleExpanded()">
        <fa-icon [icon]="expanded ? faChevronDown : faChevronRight" class="me-2"></fa-icon>
        <span>Paste venue details</span>
        <span class="badge bg-info ms-2">Smart Paste</span>
      </div>
      @if (expanded) {
        <div class="smart-paste-body mt-2">
          <textarea
            class="form-control"
            [(ngModel)]="pastedText"
            [disabled]="disabled"
            rows="4"
            placeholder="Paste venue details here (e.g., name, address, postcode, website URL)..."></textarea>
          <div class="mt-2 d-flex align-items-center gap-2">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="disabled || !pastedText?.trim()"
              (click)="parseAndApply()">
              <fa-icon [icon]="faMagic" class="me-1"></fa-icon>
              Parse & Apply
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              [disabled]="disabled"
              (click)="clearText()">
              Clear
            </button>
            @if (lastResult && lastResult.confidence > 0) {
              <span class="badge" [class.bg-success]="lastResult.confidence >= 50" [class.bg-warning]="lastResult.confidence < 50 && lastResult.confidence > 0">
                Confidence: {{ lastResult.confidence }}%
              </span>
            }
          </div>
          @if (lastResult?.warnings?.length) {
            <div class="mt-2">
              @for (warning of lastResult.warnings; track warning) {
                <div class="alert alert-warning py-1 px-2 mb-1 small d-flex align-items-center">
                  <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                  {{ warning }}
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .smart-paste-container
      border: 1px solid #dee2e6
      border-radius: 4px
      padding: 4px 12px
      background-color: #f8f9fa
      min-height: 38px
      display: flex
      flex-direction: column
      justify-content: center
    .smart-paste-header
      cursor: pointer
      user-select: none
      display: flex
      align-items: center
      font-weight: 500
    .smart-paste-body textarea
      font-family: inherit
      font-size: 0.9rem
  `]
})
export class VenueSmartPasteComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueSmartPasteComponent", NgxLoggerLevel.ERROR);
  private venueParserService = inject(VenueParserService);

  @Input() disabled = false;
  @Output() venueParsed = new EventEmitter<Partial<Venue>>();

  expanded = false;
  pastedText = "";
  lastResult: VenueParseResult | null = null;

  faChevronDown = faChevronDown;
  faChevronRight = faChevronRight;
  faMagic = faMagic;
  faExclamationTriangle = faExclamationTriangle;

  toggleExpanded() {
    this.expanded = !this.expanded;
  }

  parseAndApply() {
    if (isEmpty(this.pastedText?.trim())) {
      return;
    }

    this.logger.info("parseAndApply: parsing text");
    this.lastResult = this.venueParserService.parse(this.pastedText);

    if (this.lastResult.confidence > 0) {
      this.logger.info("parseAndApply: emitting parsed venue", this.lastResult.venue);
      this.venueParsed.emit(this.lastResult.venue);
    }
  }

  clearText() {
    this.pastedText = "";
    this.lastResult = null;
  }
}
