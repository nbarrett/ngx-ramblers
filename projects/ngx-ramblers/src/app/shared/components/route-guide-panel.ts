import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowUp, faCodeFork, faPlus, faRoute, faTrash } from "@fortawesome/free-solid-svg-icons";
import { MapMarker, RouteGuideEntry } from "../../models/content-text.model";
import { RouteBranch, RouteBranchChoice } from "../../models/route-follow.model";
import { branchChoiceLabel } from "../../functions/route-branches";
import { turnRotationDegrees } from "../../functions/route-turns";
import { milesFromStart } from "../../functions/route-step-popup";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../modules/common/resizer/resizer";

@Component({
  selector: "app-route-guide-panel",
  imports: [FontAwesomeModule, FormsModule, ResizerComponent],
  template: `
    <ng-content select="[controls]"/>
    <div class="thumbnail-heading">{{ editingNow ? "Steps" : heading }}</div>
    @if (editing && !fullscreen) {
      <p class="text-muted small mb-2">
        @if (fullScreenAvailable) {
          <a href="#" class="route-guide-link" (click)="fullScreen.emit(); $event.preventDefault()">Full screen</a> is the best place to edit these steps: a bigger map with each step beside it, where you can reword them, drag the pins along the route, and add or remove steps. You can reword, add and remove steps here too, but it is cramped and the pins cannot be moved.
        } @else {
          You can reword, add and remove steps here. Moving the pins needs a larger screen.
        }
      </p>
    } @else {
      <p class="text-muted small mb-2">
        Tap a step to see where it is on the map, or step through with
        <a href="#" class="route-guide-link" (click)="previous.emit(); $event.preventDefault()">Previous</a> and
        <a href="#" class="route-guide-link" (click)="next.emit(); $event.preventDefault()">Next</a>.
        @if (!fullscreen && fullScreenAvailable) {
          <a href="#" class="route-guide-link" (click)="fullScreen.emit(); $event.preventDefault()">Full screen</a> gives you a bigger map with the directions beside it.
        }
        Distances are measured along the route from the start.
      </p>
    }
    <ol class="route-guide-list mb-0" [id]="listId" [style.max-height]="fullscreen ? 'none' : (height ? height + 'px' : null)">
      @for (entry of entries; track entry.index) {
        @if (entry.forkIndex !== undefined) {
          <li class="route-guide-item route-guide-fork" [class.active]="activeMarker === entry.marker" [attr.data-guide-index]="entry.index"
              role="button" tabindex="0" (click)="stepSelect.emit(entry)" (keydown.enter)="stepSelect.emit(entry)">
            <span class="route-guide-number" [style.background]="markerColour"><fa-icon [icon]="faCodeFork"/></span>
            <span class="route-guide-body">
              <span class="route-guide-distance">
                @if (entry.distanceMetres !== null) {
                  {{ milesAlong(entry.distanceMetres) }}
                }
              </span>
              <span class="route-step-instruction">{{ forkHeading(entry) }}</span>
              <span class="d-flex flex-wrap gap-2 mt-1 route-guide-actions" (click)="$event.stopPropagation()">
                <button type="button" class="btn btn-sm" [class.btn-primary]="branchTaken(forkBranch(entry))" [class.btn-quiet]="!branchTaken(forkBranch(entry))" (click)="branchChoose.emit({branch: forkBranch(entry), take: true})">
                  <fa-icon [icon]="faCodeFork" class="me-1"/>{{ branchChoice(forkBranch(entry)).shortCut }}
                </button>
                <button type="button" class="btn btn-sm" [class.btn-primary]="!branchTaken(forkBranch(entry))" [class.btn-quiet]="branchTaken(forkBranch(entry))" (click)="branchChoose.emit({branch: forkBranch(entry), take: false})">
                  <fa-icon [icon]="faRoute" class="me-1"/>{{ branchChoice(forkBranch(entry)).mainRoute }}
                </button>
              </span>
            </span>
          </li>
        } @else {
          <li class="route-guide-item" [class.active]="activeMarker === entry.marker" [attr.data-guide-index]="entry.index"
              [style.border-left-color]="activeMarker === entry.marker ? null : markerColour"
              role="button" tabindex="0" (click)="stepSelect.emit(entry)" (keydown.enter)="stepSelect.emit(entry)">
            <span class="route-guide-number" [style.background]="markerColour">{{ entry.marker.label || entry.index + 1 }}</span>
            <span class="route-guide-body">
              <span class="route-guide-distance">
                @if (entry.marker.turn) {
                  <fa-icon [icon]="faArrowUp" class="route-guide-turn" [style.transform]="'rotate(' + turnDegrees(entry.marker) + 'deg)'"/>
                }
                @if (entry.distanceMetres !== null) {
                  {{ milesAlong(entry.distanceMetres) }}
                }
              </span>
              @if (editingNow) {
                <textarea class="form-control form-control-sm route-guide-edit" rows="2" [(ngModel)]="entry.marker.instruction"
                          (focus)="guideEdit.emit()" (change)="guideTextChange.emit()" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()"
                          placeholder="Direction, such as: Turn left through the churchyard"></textarea>
                <textarea class="form-control form-control-sm route-guide-edit mt-1" rows="2" [(ngModel)]="entry.marker.note"
                          (focus)="guideEdit.emit()" (change)="guideTextChange.emit()" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()"
                          placeholder="Note shown under the direction"></textarea>
                <div class="d-flex flex-wrap gap-2 mt-1 route-guide-actions" (click)="$event.stopPropagation()">
                  <button type="button" class="btn btn-sm btn-primary" (click)="addStep.emit(entry)" title="Add a step between this one and the next">
                    <fa-icon [icon]="faPlus" class="me-1"/>Add step after
                  </button>
                  <button type="button" class="btn btn-sm btn-quiet" (click)="removeStep.emit(entry)" title="Remove this step">
                    <fa-icon [icon]="faTrash" class="me-1"/>Remove
                  </button>
                </div>
              } @else {
                <span class="route-step-instruction">{{ entry.marker.instruction }}</span>
                @if (entry.marker.note) {
                  <span class="route-guide-note">{{ entry.marker.note }}</span>
                }
              }
            </span>
          </li>
        }
      }
    </ol>
    @if (!fullscreen && resizable) {
      <app-resizer [orientation]="ResizerOrientation.VERTICAL" [variant]="ResizerVariant.TAB" compact
                   [size]="height" [minSize]="minHeight" [maxSize]="maxHeight"
                   resizeHint="Drag to change the height of the directions"
                   (sizeChange)="heightChange.emit($event)" (resizeEnd)="heightSave.emit()"/>
    }
  `,
  styles: [`
    :host
      display: block
    .route-guide-list
      list-style: none
      padding: 0 4px 0 0
      max-height: 320px
      overflow-y: auto
      scroll-snap-type: y proximity
      display: flex
      flex-direction: column
      gap: 6px
    .route-guide-item
      display: flex
      gap: 10px
      scroll-snap-align: center
      padding: 10px 12px
      background: #fff
      border: 1px solid var(--rsm-border, #d9dee3)
      border-left: 5px solid #453C90
      border-radius: 8px
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)
      cursor: pointer
      &:hover
        border-color: var(--ramblers-colour-sunrise)
      &.active
        border-color: var(--ramblers-colour-sunrise)
        background: rgba(249, 177, 4, 0.12)
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14)
    .route-guide-link
      font-weight: 600
      text-decoration: underline
      color: inherit
    .route-guide-body
      display: flex
      flex-direction: column
      gap: 2px
      min-width: 0
      flex: 1 1 auto
    .route-guide-edit
      font-size: 0.9rem
      resize: vertical
  `]
})
export class RouteGuidePanel {
  @Input() entries: RouteGuideEntry[] = [];
  @Input() activeMarker: MapMarker | null = null;
  @Input() markerColour = "#453C90";
  @Input() listId = "";
  @Input() heading = "How to follow this route";
  @Input() fullscreen = false;
  @Input() fullScreenAvailable = true;
  @Input() editing = false;
  @Input() editingNow = false;
  @Input() branches: RouteBranch[] = [];
  @Input() via: number[] = [];
  @Input() height: number | null = null;
  @Input() minHeight = 0;
  @Input() maxHeight = Number.POSITIVE_INFINITY;
  @Input() resizable = true;
  @Output() stepSelect = new EventEmitter<RouteGuideEntry>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() fullScreen = new EventEmitter<void>();
  @Output() guideEdit = new EventEmitter<void>();
  @Output() guideTextChange = new EventEmitter<void>();
  @Output() addStep = new EventEmitter<RouteGuideEntry>();
  @Output() removeStep = new EventEmitter<RouteGuideEntry>();
  @Output() branchChoose = new EventEmitter<RouteBranchChoice>();
  @Output() heightChange = new EventEmitter<number>();
  @Output() heightSave = new EventEmitter<void>();
  protected readonly faArrowUp = faArrowUp;
  protected readonly faCodeFork = faCodeFork;
  protected readonly faPlus = faPlus;
  protected readonly faRoute = faRoute;
  protected readonly faTrash = faTrash;
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;

  milesAlong(metres: number): string {
    return milesFromStart(metres);
  }

  turnDegrees(marker: MapMarker): number {
    return turnRotationDegrees(marker.turn);
  }

  forkBranch(entry: RouteGuideEntry): RouteBranch {
    return this.branches.find(branch => branch.index === entry.forkIndex);
  }

  forkHeading(entry: RouteGuideEntry): string {
    const branch = this.forkBranch(entry);
    return this.branchTaken(branch) ? `Taking ${branch.label.toLowerCase()} from here` : `${branch.label} leaves the main route here`;
  }

  branchTaken(branch: RouteBranch): boolean {
    return this.via.includes(branch.index);
  }

  branchChoice(branch: RouteBranch): {shortCut: string; mainRoute: string} {
    return branchChoiceLabel(branch);
  }
}
