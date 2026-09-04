import { Component, EventEmitter, Input, Output } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faChevronLeft, faChevronRight, faExpand, faGaugeHigh, faListOl, faPencil, faPersonWalking, faRotateLeft, faTrashCan, faUndo, faUpLong } from "@fortawesome/free-solid-svg-icons";
import { ROUTE_SAVE_STATE_LABELS, ROUTE_STEP_SPEED_DEFAULT, ROUTE_STEP_SPEED_MAX, ROUTE_STEP_SPEED_MIN, ROUTE_STEP_SPEED_STEP, RouteSaveState } from "../../models/route-follow.model";

@Component({
  selector: "app-route-step-controls",
  imports: [FontAwesomeModule, NgTemplateOutlet],
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 control-pill-row">
      @if (!fullscreen) {
        <div class="control-pill" role="group" aria-label="Map view">
          <button type="button" class="control-pill-btn" (click)="fullScreen.emit()" title="Show the map full screen with the directions beside it" aria-label="Full screen">
            <fa-icon [icon]="faExpand"/><span class="d-none d-sm-inline">Full screen</span>
          </button>
          @if (count > 0) {
            <span class="control-pill-divider"></span>
            <button type="button" class="control-pill-btn" [class.active]="guideOpen" (click)="toggleGuide.emit()" [attr.aria-pressed]="guideOpen"
                    [title]="guideOpen ? 'Hide the written directions' : 'Show the written directions'">
              <fa-icon [icon]="faListOl"/><span class="d-none d-sm-inline">{{ guideOpen ? "Hide directions" : "Directions" }}</span>
            </button>
          }
          @if (canFollow) {
            <span class="control-pill-divider"></span>
            <ng-container *ngTemplateOutlet="followButton"/>
          }
        </div>
      }
      @if (stepping) {
        <div class="control-pill" role="group" aria-label="Step through the route">
          <button type="button" class="control-pill-btn control-pill-action" (click)="previous.emit()" [disabled]="activeIndex <= 0" aria-label="Previous step">
            <fa-icon [icon]="faChevronLeft"/><span class="d-none d-sm-inline">Previous</span>
          </button>
          <span class="control-pill-divider"></span>
          <span class="control-pill-text" role="status">
            @if (activeIndex >= 0) {
              Step {{ activeIndex + 1 }} of {{ count }}
            } @else {
              {{ count }} steps
            }
          </span>
          <span class="control-pill-divider"></span>
          @if (activeIndex >= count - 1) {
            <button type="button" class="control-pill-btn control-pill-action" (click)="first.emit()" aria-label="Back to the start">
              <fa-icon [icon]="faRotateLeft"/><span class="d-none d-sm-inline">Start again</span>
            </button>
          } @else {
            <button type="button" class="control-pill-btn control-pill-action" (click)="next.emit()" aria-label="Next step">
              <span class="d-none d-sm-inline">Next</span><fa-icon [icon]="faChevronRight"/>
            </button>
          }
        </div>
        <div class="control-pill" role="group" aria-label="Stepping speed">
          <label class="control-pill-text control-pill-range-label" [for]="'route-step-speed-' + id" title="How quickly the map travels between steps">
            <fa-icon [icon]="faGaugeHigh"/>
            <input type="range" class="control-pill-range" [id]="'route-step-speed-' + id"
                   [min]="speedMin" [max]="speedMax" [step]="speedStep" [value]="speed"
                   (input)="speedChange.emit($any($event.target).valueAsNumber)"/>
            <span class="control-pill-range-value">{{ speed }}×</span>
          </label>
        </div>
      }
      @if (fullscreen && (count > 0 || canFollow)) {
        <div class="control-pill" role="group" aria-label="Map and route options">
          @if (canEdit) {
            <button type="button" class="control-pill-btn" [class.active]="editing" (click)="toggleEdit.emit()" [attr.aria-pressed]="editing"
                    [title]="editing ? 'Finish editing the directions' : 'Edit the directions and drag the pins'">
              <fa-icon [icon]="editing ? faCheck : faPencil"/><span class="d-none d-sm-inline">{{ editing ? "Done" : "Edit" }}</span>
            </button>
            @if (editing) {
              <span class="control-pill-divider"></span>
              <button type="button" class="control-pill-btn" (click)="undo.emit()" [disabled]="!canUndo" title="Undo the last change">
                <fa-icon [icon]="faUndo"/><span class="d-none d-sm-inline">Undo</span>
              </button>
              <button type="button" class="control-pill-btn" (click)="discard.emit()" [disabled]="!canUndo" title="Throw away every change made since you pressed Edit">
                <fa-icon [icon]="faTrashCan"/><span class="d-none d-sm-inline">Discard</span>
              </button>
            }
            @if (editing && saveState) {
              <span class="control-pill-text control-pill-save-state">{{ saveStateLabels[saveState] }}</span>
            }
            <span class="control-pill-divider"></span>
          }
          @if (count > 0 && !editing) {
            <button type="button" class="control-pill-btn control-pill-icon" [class.active]="headingUp" (click)="toggleHeading.emit()"
                    [attr.aria-pressed]="headingUp" [title]="headingUp ? 'Keep the map north-up' : 'Turn the map with the route'"
                    [attr.aria-label]="headingUp ? 'Keep the map north-up' : 'Turn the map with the route'">
              @if (headingUp) {
                <fa-icon [icon]="faUpLong"/>
              } @else {
                <span class="route-heading-n">N</span>
              }
            </button>
          }
          @if (canFollow) {
            @if (count > 0) {
              <span class="control-pill-divider"></span>
            }
            <ng-container *ngTemplateOutlet="followButton"/>
          }
        </div>
      }
    </div>
    <ng-template #followButton>
      <button type="button" class="control-pill-btn" (click)="follow.emit()" title="Follow this route on your phone" aria-label="Follow this route">
        <fa-icon [icon]="faPersonWalking"/><span class="d-none d-sm-inline">Follow this route</span>
      </button>
    </ng-template>`
})
export class RouteStepControls {
  @Input() activeIndex = -1;
  @Input() count = 0;
  @Input() fullscreen = false;
  @Input() headingUp = false;
  @Input() canFollow = false;
  @Input() guideOpen = false;
  @Output() toggleGuide = new EventEmitter<void>();
  @Input() canEdit = false;
  @Input() editing = false;
  @Input() saveState: RouteSaveState | null = null;
  @Output() toggleEdit = new EventEmitter<void>();
  @Input() canUndo = false;
  @Output() undo = new EventEmitter<void>();
  @Output() discard = new EventEmitter<void>();
  protected readonly faTrashCan = faTrashCan;
  protected readonly faUndo = faUndo;
  protected readonly saveStateLabels = ROUTE_SAVE_STATE_LABELS;
  protected readonly faPencil = faPencil;
  protected readonly faCheck = faCheck;

  get stepping(): boolean {
    return this.count > 0 && (this.fullscreen || this.guideOpen);
  }
  @Input() speed = ROUTE_STEP_SPEED_DEFAULT;
  @Input() id = "";
  @Output() speedChange = new EventEmitter<number>();
  protected readonly speedMin = ROUTE_STEP_SPEED_MIN;
  protected readonly speedMax = ROUTE_STEP_SPEED_MAX;
  protected readonly speedStep = ROUTE_STEP_SPEED_STEP;
  protected readonly faGaugeHigh = faGaugeHigh;
  protected readonly faListOl = faListOl;
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() first = new EventEmitter<void>();
  @Output() toggleHeading = new EventEmitter<void>();
  @Output() fullScreen = new EventEmitter<void>();
  @Output() follow = new EventEmitter<void>();
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faUpLong = faUpLong;
  protected readonly faExpand = faExpand;
  protected readonly faPersonWalking = faPersonWalking;
}
