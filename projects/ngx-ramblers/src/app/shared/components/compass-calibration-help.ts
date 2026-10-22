import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, inject } from "@angular/core";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NativeCompassService } from "../../services/maps/native-compass.service";

@Component({
  selector: "app-compass-calibration-help",
  imports: [FontAwesomeModule],
  styles: [`
    :host
      display: contents
    .compass-help-screen
      height: 100dvh
      overflow: hidden
      display: flex
      flex-direction: column
      background: var(--bs-body-bg, #fff)
      color: var(--bs-body-color, #212529)
      padding: env(safe-area-inset-top) 1.25rem env(safe-area-inset-bottom)
    .compass-help-header
      flex: 0 0 auto
      padding: 1rem 0 0.5rem
    .compass-help-header h1
      margin: 0
      font-size: 1.5rem
      line-height: 1.25
    .compass-help-body
      flex: 1 1 auto
      min-height: 0
      overflow: auto
      overscroll-behavior: contain
      -webkit-overflow-scrolling: touch
    .compass-help-copy p:last-child
      margin-bottom: 0
    .compass-help-media
      padding: var(--space-2) 0
    .compass-help-media svg
      display: block
      width: 100%
      max-width: 28rem
      height: auto
      margin-inline: auto
    .compass-help-footer
      flex: 0 0 auto
      padding: 0.75rem 0 1.25rem
      display: flex
      justify-content: flex-end
    .compass-static-phone
      display: none
    @media (prefers-reduced-motion: reduce)
      .compass-moving-phone
        display: none
      .compass-static-phone
        display: inline
  `],
  template: `
    <ng-template #helpTemplate>
      <div class="compass-help-screen">
        <div class="compass-help-header">
          <h1 id="compass-help-title">Calibrate your compass</h1>
        </div>
        <div class="compass-help-body">
          <div class="compass-help-copy">
            <p>If the pointer is wrong, stand clear of metal and cases, then trace a large sideways figure of eight in the air, tilting and rolling the phone. Repeat four or five times, then turn slowly through a full circle.</p>
            @if (compass.calibrationRecommended()) {
              <p role="status"><strong>The phone still reports low compass accuracy.</strong> Try again away from magnetic objects.</p>
            }
          </div>
          <div class="compass-help-media">
            <svg viewBox="0 0 400 240" width="100%" role="img" aria-labelledby="compass-calibration-diagram-title compass-calibration-diagram-description">
              <title id="compass-calibration-diagram-title">Trace a sideways figure of eight</title>
              <desc id="compass-calibration-diagram-description">Move the phone around both loops of a sideways figure of eight, tilting and rolling as you go.</desc>
              <rect x="20" y="15" width="360" height="180" rx="8" fill="none" stroke="currentColor" stroke-width="2"/>
              <text x="200" y="44" text-anchor="middle" fill="currentColor" font-size="15">Upright, like a blackboard</text>
              <defs>
                <marker id="compass-calibration-arrow" viewBox="0 0 12 12" refX="10" refY="6"
                        markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M2 2 L10 6 L2 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </marker>
                <g id="compass-calibration-grip">
                  <image href="/assets/images/local/compass-calibration-hand.png" x="-36" y="-48" width="72" height="96"/>
                </g>
              </defs>
              <path id="compass-calibration-motion" d="M200 120 C150 55 65 65 65 120 C65 175 150 185 200 120 M200 120 C250 55 335 65 335 120 C335 175 250 185 200 120"
                    fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" marker-mid="url(#compass-calibration-arrow)"/>
              <g class="compass-static-phone" transform="translate(59 88) rotate(-18)">
                <use href="#compass-calibration-grip"/>
              </g>
              <g class="compass-static-phone" transform="translate(321 88) rotate(18)">
                <use href="#compass-calibration-grip"/>
              </g>
              <g class="compass-moving-phone">
                <animateMotion dur="6s" repeatCount="indefinite" rotate="0">
                  <mpath href="#compass-calibration-motion"/>
                </animateMotion>
                <g>
                  <animateTransform attributeName="transform" type="rotate" values="-22;22;22;-22;-22" dur="6s" repeatCount="indefinite"/>
                  <g>
                    <animateTransform attributeName="transform" type="scale" values="1 1;1 0.72;1 1;1 0.72;1 1" dur="6s" repeatCount="indefinite"/>
                    <use href="#compass-calibration-grip"/>
                  </g>
                </g>
              </g>
              <text x="200" y="224" text-anchor="middle" fill="currentColor" font-size="15">Tilt and roll as you go</text>
            </svg>
          </div>
        </div>
        <div class="compass-help-footer">
          <button type="button" class="btn btn-primary" (click)="closed.emit()">
            <fa-icon [icon]="faArrowLeft"/>
            {{ backLabel }}
          </button>
        </div>
      </div>
    </ng-template>
  `
})
export class CompassCalibrationHelpComponent implements OnInit, OnDestroy {
  protected readonly faArrowLeft = faArrowLeft;
  private modalService = inject(BsModalService);
  private modal: BsModalRef | null = null;
  private helpOpen = false;
  @ViewChild("helpTemplate", {static: true}) private helpTemplate: TemplateRef<unknown>;
  @Input() set open(value: boolean) {
    this.helpOpen = value;
    if (this.helpTemplate) {
      this.syncModal();
    }
  }
  @Input() backLabel = "Back to map";
  @Output() closed = new EventEmitter<void>();
  protected compass = inject(NativeCompassService);

  ngOnInit(): void {
    this.syncModal();
  }

  ngOnDestroy(): void {
    this.modal?.hide();
  }

  private syncModal(): void {
    if (this.helpOpen && !this.modal) {
      this.modal = this.modalService.show(this.helpTemplate, {
        class: "modal-fullscreen",
        animated: false,
        ignoreBackdropClick: true,
        keyboard: false,
        ariaLabelledBy: "compass-help-title"
      });
    } else if (!this.helpOpen && this.modal) {
      this.modal.hide();
      this.modal = null;
    }
  }
}
